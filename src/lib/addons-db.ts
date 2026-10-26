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
  profile: Profile,
  addon: AddonRow,
  cpfCnpj: string | null,
): Promise<{ invoiceUrl: string }> {
  const customerId = await obterOuCriarClienteAsaas(profile, cpfCnpj || profile.cpf_cnpj || "");

  const assinatura = await criarAssinatura({
    customerId,
    valorCentavos: addon.preco_centavos,
    descricao: `Add-on ${addon.nome}`,
    externalReference: `${profile.id}:${addon.id}`,
  });

  // Cliente admin: o usuário só lê as próprias assinaturas de extras.
  const { error } = await createAdminClient()
    .from("user_addon_subscriptions")
    .upsert(
      { user_id: profile.id, addon_id: addon.id, asaas_subscription_id: assinatura.id, status: "pendente", atualizado_em: new Date().toISOString() },
      { onConflict: "user_id,addon_id" },
    );
  // Sem a assinatura gravada, o webhook não acharia o extra e o pagamento não o ativaria.
  if (error) throw new Error("Não foi possível registrar a assinatura do extra.");

  const fatura = await obterPrimeiraFaturaAssinatura(assinatura.id);
  if (!fatura) throw new Error("Assinatura criada, mas a fatura ainda não foi gerada. Atualize a página em instantes.");
  return { invoiceUrl: fatura.invoiceUrl };
}

/** Cancela no Asaas — mantém a linha (histórico), só marca cancelada e limpa o subscription_id, pra permitir assinar de novo depois sem colidir com o unique. NÃO revoga o feature_flag concedido (mesma cautela de cancelarPlano — revogar é ação manual do admin), com uma exceção: o WhatsApp API oficial, que custa por canal (ver revogarWhatsappOficialSeForaDoPlano). */
export async function cancelarAddon(assinatura: UserAddonSubscriptionRow): Promise<void> {
  if (!assinatura.asaas_subscription_id) return;
  await cancelarAssinatura(assinatura.asaas_subscription_id);
  const sbAdmin = createAdminClient();
  await sbAdmin
    .from("user_addon_subscriptions")
    .update({ asaas_subscription_id: null, status: "cancelada" as AddonSubscriptionStatus, atualizado_em: new Date().toISOString() })
    .eq("id", assinatura.id);
  const { data: addon } = await sbAdmin.from("addons").select("feature_flag").eq("id", assinatura.addon_id).maybeSingle();
  if ((addon as { feature_flag?: string } | null)?.feature_flag === "whatsapp_oficial_habilitado") {
    await revogarWhatsappOficialSeForaDoPlano(assinatura.user_id);
  }
}

/**
 * WhatsApp API oficial: a plataforma paga um canal por cliente na Datafy.
 * Ao cancelar o add-on, quem não tem o recurso pelo plano perde o recurso
 * (o worker cancela o canal na Datafy em seguida).
 */
export async function revogarWhatsappOficialSeForaDoPlano(userId: string): Promise<void> {
  const sbAdmin = createAdminClient();
  const { data: perfil } = await sbAdmin.from("profiles").select("plano_id, assinatura_status").eq("id", userId).maybeSingle();
  const p = perfil as { plano_id: string | null; assinatura_status: string } | null;
  if (p?.plano_id && ["ativa", "inadimplente"].includes(p.assinatura_status)) {
    const { data: plano } = await sbAdmin.from("plans").select("whatsapp_oficial_habilitado").eq("id", p.plano_id).maybeSingle();
    if ((plano as { whatsapp_oficial_habilitado?: boolean } | null)?.whatsapp_oficial_habilitado) return;
  }
  await sbAdmin.from("profiles").update({ whatsapp_oficial_habilitado: false }).eq("id", userId);
}

/** O add-on de WhatsApp API oficial está pago (ou em carência) para a pessoa. */
export async function temAddonWhatsappOficial(userId: string): Promise<boolean> {
  const sbAdmin = createAdminClient();
  const { data: addons } = await sbAdmin.from("addons").select("id").eq("feature_flag", "whatsapp_oficial_habilitado");
  const ids = ((addons ?? []) as { id: string }[]).map((a) => a.id);
  if (!ids.length) return false;
  const { count } = await sbAdmin
    .from("user_addon_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("addon_id", ids)
    .in("status", ["ativa", "inadimplente"]);
  return Boolean(count);
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
