import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterOuCriarClienteAsaas } from "@/lib/credit-purchases-db";
import { criarAssinatura, cancelarAssinatura, obterPrimeiraFaturaAssinatura } from "@/lib/integrations/asaas";
import type { PlanRow, Profile } from "@/lib/database.types";

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
 * pra onde redirecionar o cliente.
 */
export async function assinarPlano(
  sb: SupabaseClient,
  profile: Profile,
  plano: PlanRow,
  cpfCnpj: string | null,
): Promise<{ invoiceUrl: string }> {
  const customerId = await obterOuCriarClienteAsaas(sb, profile, cpfCnpj || profile.cpf_cnpj || "");

  const assinatura = await criarAssinatura({
    customerId,
    valorCentavos: plano.preco_centavos,
    descricao: `Assinatura ${plano.nome}`,
    externalReference: profile.id,
  });

  await sb
    .from("profiles")
    .update({ plano_id: plano.id, asaas_subscription_id: assinatura.id, assinatura_status: "pendente" })
    .eq("id", profile.id);

  const fatura = await obterPrimeiraFaturaAssinatura(assinatura.id);
  if (!fatura) throw new Error("Assinatura criada, mas a fatura ainda não foi gerada. Atualize a página em instantes.");
  return { invoiceUrl: fatura.invoiceUrl };
}

/** Cancela no Asaas e limpa o vínculo — mantém `plano_id` como referência histórica ("seu último plano"), mas `asaas_subscription_id` some pra permitir assinar de novo depois sem colidir. */
export async function cancelarPlano(sb: SupabaseClient, profile: Profile): Promise<void> {
  if (!profile.asaas_subscription_id) return;
  await cancelarAssinatura(profile.asaas_subscription_id);
  await sb
    .from("profiles")
    .update({ asaas_subscription_id: null, assinatura_status: "cancelada" })
    .eq("id", profile.id);
}

/**
 * Chamado pelo webhook quando uma cobrança com `payment.subscription`
 * preenchido é confirmada — é assim que diferenciamos renovação de
 * assinatura de compra avulsa (que nunca tem esse campo). Idempotente
 * via `asaas_payment_id` unique: se o INSERT falhar por conflito, é
 * reentrega do mesmo evento, não credita de novo.
 */
export async function processarPagamentoAssinatura(asaasSubscriptionId: string, asaasPaymentId: string, precoCentavos: number): Promise<void> {
  const sbAdmin = createAdminClient();

  const { data: dono } = await sbAdmin
    .from("profiles")
    .select("id, plano_id")
    .eq("asaas_subscription_id", asaasSubscriptionId)
    .maybeSingle();
  if (!dono) return; // assinatura cancelada/desconhecida — ignora silenciosamente.

  const { data: inserido, error } = await sbAdmin
    .from("subscription_payments")
    .insert({
      user_id: dono.id,
      plan_id: dono.plano_id,
      asaas_subscription_id: asaasSubscriptionId,
      asaas_payment_id: asaasPaymentId,
      preco_centavos: precoCentavos,
      status: "pago",
    })
    .select("id")
    .maybeSingle();
  if (error || !inserido) return; // conflito de unique (evento repetido) ou outro erro — não credita.

  const { data: plano } = await sbAdmin.from("plans").select("creditos_mensais").eq("id", dono.plano_id).maybeSingle();
  const creditosMensais = plano?.creditos_mensais ?? 0;

  await sbAdmin
    .from("profiles")
    .update({ assinatura_status: "ativa", monthly_creditos: creditosMensais, credits_renewed_at: new Date().toISOString().slice(0, 10) })
    .eq("id", dono.id);

  if (creditosMensais > 0) {
    await sbAdmin.rpc("increment_creditos", { p_user_id: dono.id, p_delta: creditosMensais });
  }
}

/** Chamado pelo webhook em falha/vencimento de cobrança de assinatura (PAYMENT_OVERDUE) — não credita nada, só marca o status pra UI avisar o usuário. */
export async function marcarAssinaturaInadimplente(asaasSubscriptionId: string): Promise<void> {
  const sbAdmin = createAdminClient();
  await sbAdmin
    .from("profiles")
    .update({ assinatura_status: "inadimplente" })
    .eq("asaas_subscription_id", asaasSubscriptionId);
}
