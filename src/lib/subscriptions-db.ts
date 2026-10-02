import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterOuCriarClienteAsaas } from "@/lib/credit-purchases-db";
import { criarAssinatura, cancelarAssinatura, obterPrimeiraFaturaAssinatura } from "@/lib/integrations/asaas";
import { PLAN_FEATURE_FLAG_KEYS, type AssinaturaCiclo, type PlanRow, type Profile } from "@/lib/database.types";

// Assinatura recorrente de plano via Asaas — ver comentário de topo de
// supabase/migrations/0018_asaas_subscriptions.sql pro desenho geral.
// Mesma separação de responsabilidade de credit-purchases-db.ts: funções
// chamadas pela rota do usuário usam o cliente autenticado (RLS), a que
// processa o webhook usa sempre o cliente admin.

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
  const customerId = await obterOuCriarClienteAsaas(profile, cpfCnpj || profile.cpf_cnpj || "");

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
  await cancelarAssinatura(profile.asaas_subscription_id);
  await createAdminClient()
    .from("profiles")
    .update({ asaas_subscription_id: null, assinatura_status: "cancelada" })
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
    .select("id, plano_id, assinatura_status, assinatura_ciclo")
    .eq("asaas_subscription_id", asaasSubscriptionId)
    .maybeSingle();
  if (!dono) return false; // não é uma assinatura de PLANO conhecida — deixa o caller tentar add-on.

  const { data: planoData } = await sbAdmin.from("plans").select("*").eq("id", dono.plano_id).maybeSingle();
  const plano = planoData as PlanRow | null;
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
  if (!registrado) return true; // conflito de unique (evento repetido) — não credita de novo, mas já sabemos que era um plano.

  const campos: Record<string, unknown> = {
    assinatura_status: "ativa",
    // Assinou: encerra o teste grátis (se havia), liberando a plataforma.
    teste_gratis: false,
    monthly_creditos: creditosMensais,
    credits_renewed_at: new Date().toISOString().slice(0, 10),
  };

  // Bundle de features do plano — só aplicado na 1ª ativação desta
  // assinatura (não a cada renovação mensal, pra não sobrescrever um
  // flag que o admin tenha revogado manualmente depois). Sempre por OR:
  // nunca tira um flag que o usuário já tinha, só concede o que falta.
  if (plano && dono.assinatura_status !== "ativa") {
    for (const chave of PLAN_FEATURE_FLAG_KEYS) {
      if (plano[chave]) campos[chave] = true;
    }
  }

  await sbAdmin.from("profiles").update(campos).eq("id", dono.id);

  return true;
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
