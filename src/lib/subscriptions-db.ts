import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterOuCriarClienteAsaas } from "@/lib/credit-purchases-db";
import { criarAssinatura, cancelarAssinatura, obterPrimeiraFaturaAssinatura } from "@/lib/integrations/asaas";
import { PLAN_FEATURE_FLAG_KEYS, type AssinaturaCiclo, type PlanRow, type Profile } from "@/lib/database.types";
import { dataISOBrasil } from "@/lib/datas";
import { planoNaCondicao, type CondicaoPreco } from "@/lib/condicao-preco";
import { enviarConversaoMeta, registrarEventoServidor } from "@/lib/rastreamento/servidor";
import { fimDoPeriodo } from "@/lib/acesso-regras";
import { registrarLeadLP } from "@/lib/lp-leads";
import { temAddonWhatsappOficial } from "@/lib/addons-db";

// Assinatura recorrente de plano via Asaas — ver comentário de topo de
// supabase/migrations/0018_asaas_subscriptions.sql pro desenho geral.
// Mesma separação de responsabilidade de credit-purchases-db.ts: funções
// chamadas pela rota do usuário usam o cliente autenticado (RLS), a que
// processa o webhook usa sempre o cliente admin.

/** Status de cobrança já paga no Asaas (mesma lista do webhook). */
const STATUS_PAGO = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

/** A fatura da assinatura pendente já foi paga — falta só o aviso do Asaas chegar; não dá para trocar. */
export class AssinaturaJaPaga extends Error {
  constructor() {
    super("O pagamento desta assinatura já foi feito e está sendo confirmado. Em instantes seu plano fica ativo; depois disso dá para trocar.");
  }
}

export async function listarPlanosAtivos(sb: SupabaseClient): Promise<PlanRow[]> {
  const { data } = await sb.from("plans").select("*").eq("ativo", true).order("ordem");
  return (data as PlanRow[]) ?? [];
}

/**
 * Cria a assinatura no Asaas e já marca o perfil como `pendente` (só vira
 * `ativa` quando o webhook confirmar a 1ª cobrança). Retorna a fatura
 * pra onde redirecionar o cliente. `ciclo` decide o preço cobrado
 * (`preco_centavos` mensal vs `preco_anual_centavos`) e o `cycle` da
 * assinatura no Asaas (MONTHLY vs YEARLY) — uma assinatura anual real,
 * 1 cobrança por ano, não 12 cobranças de um valor menor.
 */
export async function assinarPlano(
  sb: SupabaseClient,
  profile: Profile,
  plano: PlanRow,
  cpfCnpj: string | null,
  ciclo: AssinaturaCiclo = "mensal",
): Promise<{ invoiceUrl: string }> {
  // Assinatura aguardando o 1º pagamento: a pessoa voltou da fatura para
  // trocar de plano ou de ciclo (mensal ↔ anual). Mesmo plano e ciclo
  // reabre a fatura que já existe; outra escolha cancela a pendente no
  // Asaas antes de criar a nova — sem isso ela ficava órfã, cobrando.
  if (profile.assinatura_status === "pendente" && profile.asaas_subscription_id) {
    const faturaAtual = await obterPrimeiraFaturaAssinatura(profile.asaas_subscription_id).catch(() => null);
    if (faturaAtual && STATUS_PAGO.has(faturaAtual.status)) throw new AssinaturaJaPaga();
    if (profile.plano_id === plano.id && (profile.assinatura_ciclo ?? "mensal") === ciclo && faturaAtual) {
      return { invoiceUrl: faturaAtual.invoiceUrl };
    }
    await cancelarAssinatura(profile.asaas_subscription_id);
    await createAdminClient()
      .from("profiles")
      .update({ asaas_subscription_id: null, assinatura_status: "sem_assinatura" })
      .eq("id", profile.id);
  }

  const customerId = await obterOuCriarClienteAsaas(profile, cpfCnpj || profile.cpf_cnpj || "");
  // Cliente com condição de preço travada assina pelo preço da fotografia.
  plano = planoNaCondicao(plano, profile.condicao_preco);

  const valorCentavos = ciclo === "anual" ? (plano.preco_anual_centavos ?? plano.preco_centavos * 12) : plano.preco_centavos;

  const assinatura = await criarAssinatura({
    customerId,
    valorCentavos,
    descricao: `Assinatura ${plano.nome} (${ciclo === "anual" ? "anual" : "mensal"})`,
    externalReference: profile.id,
    cycle: ciclo === "anual" ? "YEARLY" : "MONTHLY",
  });

  // Cliente admin: campos de assinatura são protegidos contra escrita pelo
  // próprio usuário (0028_seguranca_profiles.sql) — só o servidor altera.
  await createAdminClient()
    .from("profiles")
    .update({ plano_id: plano.id, asaas_subscription_id: assinatura.id, assinatura_status: "pendente", assinatura_ciclo: ciclo })
    .eq("id", profile.id);

  const fatura = await obterPrimeiraFaturaAssinatura(assinatura.id);
  if (!fatura) throw new Error("Assinatura criada, mas a fatura ainda não foi gerada. Atualize a página em instantes.");
  return { invoiceUrl: fatura.invoiceUrl };
}

/** Cancela no Asaas e limpa o vínculo — mantém `plano_id` como referência histórica ("seu último plano"), mas `asaas_subscription_id` some pra permitir assinar de novo depois sem colidir. */
export async function cancelarPlano(profile: Profile): Promise<void> {
  if (!profile.asaas_subscription_id) return;
  // Desistir de uma assinatura que nunca foi paga não é "cancelar o plano":
  // a pessoa volta para "sem assinatura", como se não tivesse começado.
  const nuncaPaga = profile.assinatura_status === "pendente";
  if (nuncaPaga) {
    const fatura = await obterPrimeiraFaturaAssinatura(profile.asaas_subscription_id).catch(() => null);
    if (fatura && STATUS_PAGO.has(fatura.status)) throw new AssinaturaJaPaga();
  }
  await cancelarAssinatura(profile.asaas_subscription_id);
  await createAdminClient()
    .from("profiles")
    .update({ asaas_subscription_id: null, assinatura_status: nuncaPaga ? "sem_assinatura" : "cancelada" })
    .eq("id", profile.id);
}

/**
 * Chamado pelo webhook quando uma cobrança com `payment.subscription`
 * preenchido é confirmada — é assim que diferenciamos renovação de
 * assinatura de compra avulsa (que nunca tem esse campo). Idempotente
 * via `asaas_payment_id` unique. O INSERT em `subscription_payments` e o
 * crédito acontecem juntos em `registrar_pagamento_assinatura_e_creditar`
 * (0027_atomic_payment_credit.sql, mesma razão de
 * `marcar_compra_paga_e_creditar` em credit-purchases-db.ts) — evita que
 * um erro transitório entre as duas escritas deixe o pagamento
 * "registrado" sem o crédito ter sido de fato concedido. Erro de verdade
 * aqui propaga (o handler do webhook responde 500, o Asaas reentrega); o
 * update de status/flags do perfil, feito depois, é seguro de repetir
 * (idempotente por natureza) e por isso fica fora da transação atômica.
 */
export async function processarPagamentoAssinatura(asaasSubscriptionId: string, asaasPaymentId: string, precoCentavos: number): Promise<boolean> {
  const sbAdmin = createAdminClient();

  const { data: dono } = await sbAdmin
    .from("profiles")
    .select("id, plano_id, assinatura_status, assinatura_ciclo, condicao_preco")
    .eq("asaas_subscription_id", asaasSubscriptionId)
    .maybeSingle();
  if (!dono) return false; // não é uma assinatura de PLANO conhecida — deixa o caller tentar add-on.

  const { data: planoData } = await sbAdmin.from("plans").select("*").eq("id", dono.plano_id).maybeSingle();
  // Créditos do plano pela condição travada do cliente, se houver.
  const plano = planoData ? planoNaCondicao(planoData as PlanRow, dono.condicao_preco as CondicaoPreco | null) : null;
  const creditosMensais = plano?.creditos_mensais ?? 0;
  // Anual só recebe 1 evento de pagamento por ANO (não por mês) — credita
  // os 12 meses de uma vez no momento da confirmação, em vez de tentar
  // represar 1/12 por mês sem ter um calendário próprio pra isso. Ver
  // comentário de topo de 0026_annual_billing.sql.
  const creditosConcedidos = dono.assinatura_ciclo === "anual" ? creditosMensais * 12 : creditosMensais;

  const { data: registrado, error } = await sbAdmin.rpc("registrar_pagamento_assinatura_e_creditar", {
    p_user_id: dono.id,
    p_plan_id: dono.plano_id,
    p_asaas_subscription_id: asaasSubscriptionId,
    p_asaas_payment_id: asaasPaymentId,
    p_preco_centavos: precoCentavos,
    p_creditos: creditosConcedidos,
  });
  if (error) {
    console.error("[processarPagamentoAssinatura] falha ao registrar pagamento", asaasPaymentId, error);
    throw new Error(`Falha ao registrar pagamento de assinatura: ${error.message}`);
  }
  // Conflito de unique (evento repetido, como o PAYMENT_RECEIVED que chega
  // ~30 dias depois do CONFIRMED no cartão): não credita nem reativa nada.
  // A exceção é a 1ª ativação que falhou na entrega anterior (o perfil
  // continua "pendente"): aí refaz só a atualização do perfil.
  if (!registrado && dono.assinatura_status !== "pendente") return true;

  const campos: Record<string, unknown> = {
    assinatura_status: "ativa",
    // Assinou: encerra o teste grátis (se havia), liberando a plataforma.
    teste_gratis: false,
    monthly_creditos: creditosMensais,
    credits_renewed_at: dataISOBrasil(),
  };

  // Bundle de features do plano — só aplicado na 1ª ativação desta
  // assinatura (não a cada renovação mensal, pra não sobrescrever um
  // flag que o admin tenha revogado manualmente depois). Sempre por OR:
  // nunca tira um flag que o usuário já tinha, só concede o que falta.
  if (plano && dono.assinatura_status !== "ativa") {
    for (const chave of PLAN_FEATURE_FLAG_KEYS) {
      if (plano[chave]) campos[chave] = true;
    }
    // Exceção ao "só concede": o WhatsApp API oficial custa por canal, então
    // vale o que o plano novo inclui (ou o add-on pago), não o que sobrou de
    // um plano anterior. Só quando a coluna já existe (migration 0050).
    if ("whatsapp_oficial_habilitado" in plano) {
      campos.whatsapp_oficial_habilitado = Boolean(plano.whatsapp_oficial_habilitado) || (await temAddonWhatsappOficial(dono.id));
    }
  }

  // Fim do período pago por este pagamento (regra de acesso em acesso-regras.ts).
  campos.acesso_ate = fimDoPeriodo(dono.assinatura_ciclo as AssinaturaCiclo | null);
  const { error: erroPerfil } = await sbAdmin.from("profiles").update(campos).eq("id", dono.id);
  if (erroPerfil && /acesso_ate/.test(erroPerfil.message)) {
    // Sem a migration 0047: ativa o plano mesmo assim.
    delete campos.acesso_ate;
    const { error } = await sbAdmin.from("profiles").update(campos).eq("id", dono.id);
    if (error) throw new Error(`Falha ao ativar o plano no perfil: ${error.message}`);
  } else if (erroPerfil) {
    // 500 no webhook: o Asaas reentrega e a ativação é refeita (o crédito não repete).
    throw new Error(`Falha ao ativar o plano no perfil: ${erroPerfil.message}`);
  }

  // 1º pagamento de uma assinatura nova (estava aguardando pagamento): é a
  // venda. Renovações e reativações de inadimplência não contam de novo.
  if (dono.assinatura_status === "pendente") {
    after(() => registrarCompra(dono.id, asaasSubscriptionId, precoCentavos, plano));
  }

  return true;
}

/** Id do evento de compra: o mesmo na página de boas-vindas (Pixel) e aqui (API de Conversões). */
export function idEventoCompra(asaasSubscriptionId: string): string {
  return `compra-${asaasSubscriptionId}`;
}

async function registrarCompra(userId: string, asaasSubscriptionId: string, precoCentavos: number, plano: PlanRow | null) {
  const { data: perfil } = await createAdminClient()
    .from("profiles")
    .select("email, telefone, nome, rastreamento")
    .eq("id", userId)
    .maybeSingle();
  const rastreamento = (perfil as { rastreamento?: Profile["rastreamento"] } | null)?.rastreamento ?? null;
  await registrarEventoServidor("compra", rastreamento, userId, plano?.nome);
  await registrarLeadLP({
    etapa: "cliente",
    userId,
    origem: rastreamento,
    dados: { nome: perfil?.nome, email: perfil?.email, telefone: perfil?.telefone, plano: plano?.nome },
  });
  await enviarConversaoMeta({
    nome: "Purchase",
    eventId: idEventoCompra(asaasSubscriptionId),
    pessoa: { userId, email: perfil?.email, telefone: perfil?.telefone, nome: perfil?.nome, rastreamento },
    pagina: "/bem-vindo",
    valor: precoCentavos / 100,
    conteudo: plano ? { id: plano.id, nome: plano.nome } : undefined,
  });
}

/** Chamado pelo webhook em falha/vencimento de cobrança de assinatura (PAYMENT_OVERDUE) — não credita nada, só marca o status pra UI avisar o usuário. Retorna se era uma assinatura de PLANO conhecida, pra o caller tentar add-on senão. */
export async function marcarAssinaturaInadimplente(asaasSubscriptionId: string): Promise<boolean> {
  const sbAdmin = createAdminClient();
  const { data } = await sbAdmin
    .from("profiles")
    .update({ assinatura_status: "inadimplente" })
    .eq("asaas_subscription_id", asaasSubscriptionId)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

/**
 * Assinatura removida ou desativada direto no Asaas (pelo painel, não pelo
 * cancelamento da plataforma, que já limpa o vínculo): o perfil deixa de
 * contar com ela. Quem já pagou fica "cancelada" e usa até o fim do período
 * pago (acesso_ate); quem nunca pagou volta para "sem_assinatura".
 */
export async function encerrarAssinaturaRemovida(asaasSubscriptionId: string): Promise<void> {
  const sbAdmin = createAdminClient();
  const { data: dono } = await sbAdmin
    .from("profiles")
    .select("id, assinatura_status")
    .eq("asaas_subscription_id", asaasSubscriptionId)
    .maybeSingle();
  if (!dono) return;
  const { error } = await sbAdmin
    .from("profiles")
    .update({ asaas_subscription_id: null, assinatura_status: dono.assinatura_status === "pendente" ? "sem_assinatura" : "cancelada" })
    .eq("id", dono.id);
  if (error) throw new Error(`Falha ao encerrar a assinatura no perfil: ${error.message}`);
}

