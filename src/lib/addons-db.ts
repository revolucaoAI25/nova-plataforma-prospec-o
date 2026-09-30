import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterOuCriarClienteAsaas } from "@/lib/credit-purchases-db";
import { criarAssinatura, cancelarAssinatura, obterPrimeiraFaturaAssinatura } from "@/lib/integrations/asaas";
import type { AddonRow, AddonSubscriptionStatus, Profile, UserAddonSubscriptionRow } from "@/lib/database.types";

// Add-ons pagos avulsos por assinatura recorrente própria — mirror de
// subscriptions-db.ts, mas 1 linha por (usuário, add-on) em vez de
// colunas singulares em `profiles`, já que um usuário pode ter várias
// assinaturas Asaas simultâneas (plano + N add-ons). Ver comentário de
// topo de supabase/migrations/0025_addon_subscriptions.sql pro desenho
// geral e pro porquê da v1 cobrir só o add-on de LinkedIn.

export async function listarAddonsAtivos(sb: SupabaseClient): Promise<AddonRow[]> {
  const { data } = await sb.from("addons").select("*").eq("ativo", true).order("ordem");
  return (data as AddonRow[]) ?? [];
}

export async function listarAssinaturasAddonsDoUsuario(sb: SupabaseClient, userId: string): Promise<UserAddonSubscriptionRow[]> {
  const { data } = await sb.from("user_addon_subscriptions").select("*").eq("user_id", userId);
  return (data as UserAddonSubscriptionRow[]) ?? [];
}

/**
 * Cria a assinatura do add-on no Asaas e já marca a linha como `pendente`
 * (só vira `ativa` quando o webhook confirmar a 1ª cobrança). Retorna a
 * fatura pra onde redirecionar o cliente. `upsert` porque o usuário pode
 * ter cancelado esse mesmo add-on antes e estar assinando de novo — a
 * linha (user_id, addon_id) é reaproveitada em vez de duplicada.
 */
export async function assinarAddon(
  sb: SupabaseClient,
  profile: Profile,
  addon: AddonRow,
  cpfCnpj: string | null,
): Promise<{ invoiceUrl: string }> {
  const customerId = await obterOuCriarClienteAsaas(sb, profile, cpfCnpj || profile.cpf_cnpj || "");

  const assinatura = await criarAssinatura({
    customerId,
    valorCentavos: addon.preco_centavos,
    descricao: `Add-on ${addon.nome}`,
    externalReference: `${profile.id}:${addon.id}`,
  });

  await sb
    .from("user_addon_subscriptions")
    .upsert(
      { user_id: profile.id, addon_id: addon.id, asaas_subscription_id: assinatura.id, status: "pendente", atualizado_em: new Date().toISOString() },
      { onConflict: "user_id,addon_id" },
    );

  const fatura = await obterPrimeiraFaturaAssinatura(assinatura.id);
  if (!fatura) throw new Error("Assinatura criada, mas a fatura ainda não foi gerada. Atualize a página em instantes.");
  return { invoiceUrl: fatura.invoiceUrl };
}

/** Cancela no Asaas — mantém a linha (histórico), só marca cancelada e limpa o subscription_id, pra permitir assinar de novo depois sem colidir com o unique. NÃO revoga o feature_flag concedido (mesma cautela de cancelarPlano — revogar é ação manual do admin). */
export async function cancelarAddon(sb: SupabaseClient, assinatura: UserAddonSubscriptionRow): Promise<void> {
  if (!assinatura.asaas_subscription_id) return;
  await cancelarAssinatura(assinatura.asaas_subscription_id);
  await sb
    .from("user_addon_subscriptions")
    .update({ asaas_subscription_id: null, status: "cancelada" as AddonSubscriptionStatus, atualizado_em: new Date().toISOString() })
    .eq("id", assinatura.id);
}

/**
 * Chamado pelo webhook quando uma cobrança de assinatura de add-on é
 * confirmada. Idempotente via `asaas_payment_id` unique em
 * `addon_payments`, mesmo mecanismo de `processarPagamentoAssinatura`.
 */
export async function processarPagamentoAddon(asaasSubscriptionId: string, asaasPaymentId: string, precoCentavos: number): Promise<boolean> {
  const sbAdmin = createAdminClient();

  const { data: assinatura } = await sbAdmin
    .from("user_addon_subscriptions")
    .select("id, user_id, addon_id, status")
    .eq("asaas_subscription_id", asaasSubscriptionId)
    .maybeSingle();
  if (!assinatura) return false; // não é uma assinatura de add-on conhecida — deixa o caller tentar outro caminho.

  const { data: inserido, error } = await sbAdmin
    .from("addon_payments")
    .insert({
      user_id: assinatura.user_id,
      addon_id: assinatura.addon_id,
      asaas_subscription_id: asaasSubscriptionId,
      asaas_payment_id: asaasPaymentId,
      preco_centavos: precoCentavos,
      status: "pago",
    })
    .select("id")
    .maybeSingle();
  if (error && error.code !== "23505") {
    // 23505 = unique_violation (evento repetido, esperado). Qualquer outro
    // erro é genuíno — só um log aqui (add-on não credita saldo, o único
    // efeito é o feature_flag abaixo, que é seguro reaplicar num reenvio
    // futuro do mesmo evento; não precisa da mesma atomicidade dos casos
    // que mexem em créditos).
    console.error("[processarPagamentoAddon] falha ao registrar pagamento", asaasPaymentId, error);
  }
  if (error || !inserido) return true;

  const { data: addonData } = await sbAdmin.from("addons").select("*").eq("id", assinatura.addon_id).maybeSingle();
  const addon = addonData as AddonRow | null;

  await sbAdmin
    .from("user_addon_subscriptions")
    .update({ status: "ativa", atualizado_em: new Date().toISOString() })
    .eq("id", assinatura.id);

  // Só concede o flag na 1ª ativação (não a cada renovação mensal) —
  // mesma lógica de processarPagamentoAssinatura, e nunca revoga nada.
  if (addon && assinatura.status !== "ativa") {
    await sbAdmin.from("profiles").update({ [addon.feature_flag]: true }).eq("id", assinatura.user_id);
  }

  return true;
}

/** Chamado pelo webhook em falha/vencimento de cobrança de add-on (PAYMENT_OVERDUE). */
export async function marcarAddonInadimplente(asaasSubscriptionId: string): Promise<boolean> {
  const sbAdmin = createAdminClient();
  const { data } = await sbAdmin
    .from("user_addon_subscriptions")
    .update({ status: "inadimplente", atualizado_em: new Date().toISOString() })
    .eq("asaas_subscription_id", asaasSubscriptionId)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}
