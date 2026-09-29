import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarClienteAsaas, criarCobranca } from "@/lib/integrations/asaas";
import type { CreditPackageRow, CreditPurchaseRow, Profile } from "@/lib/database.types";

// Compra de créditos avulsos via Asaas — ver comentário de topo de
// supabase/migrations/0017_asaas_credit_purchases.sql pro desenho geral.
// `criarCompra` roda com o cliente AUTENTICADO do usuário (RLS garante
// que a linha nasce com user_id correto); `marcarCompraPaga` roda sempre
// com o cliente ADMIN, porque quem chama é o webhook, sem sessão de
// usuário nenhuma — e é essa mesma ausência de sessão que torna seguro
// não ter policy de UPDATE pro usuário comum: só o webhook credita.

export async function listarPacotesAtivos(sb: SupabaseClient): Promise<CreditPackageRow[]> {
  const { data } = await sb.from("credit_packages").select("*").eq("ativo", true).order("ordem");
  return (data as CreditPackageRow[]) ?? [];
}

export async function listarComprasDoUsuario(sb: SupabaseClient, userId: string): Promise<CreditPurchaseRow[]> {
  const { data } = await sb
    .from("credit_purchases")
    .select("*")
    .eq("user_id", userId)
    .order("criado_em", { ascending: false })
    .limit(20);
  return (data as CreditPurchaseRow[]) ?? [];
}

/** Reusa `profiles.asaas_customer_id` se já existir; senão cria o cliente no Asaas e persiste o id (evita duplicar cliente a cada compra). */
async function obterOuCriarClienteAsaas(sb: SupabaseClient, profile: Profile, cpfCnpj: string): Promise<string> {
  if (profile.asaas_customer_id) return profile.asaas_customer_id;

  const customerId = await criarClienteAsaas({
    nome: profile.email,
    cpfCnpj,
    email: profile.email,
    externalReference: profile.id,
  });
  await sb.from("profiles").update({ asaas_customer_id: customerId, cpf_cnpj: cpfCnpj }).eq("id", profile.id);
  return customerId;
}

/**
 * Cria a cobrança no Asaas e a linha `pendente` correspondente. Retorna a
 * URL da fatura hospedada pra onde o cliente deve ser redirecionado.
 * `cpfCnpj` só é obrigatório na 1ª compra (perfil ainda sem
 * `asaas_customer_id`) — chamado já validou isso antes de chegar aqui.
 */
export async function criarCompra(
  sb: SupabaseClient,
  profile: Profile,
  pacote: CreditPackageRow,
  cpfCnpj: string | null,
): Promise<{ invoiceUrl: string }> {
  const customerId = await obterOuCriarClienteAsaas(sb, profile, cpfCnpj || profile.cpf_cnpj || "");

  const { data: compra, error } = await sb
    .from("credit_purchases")
    .insert({
      user_id: profile.id,
      package_id: pacote.id,
      quantidade_creditos: pacote.quantidade_creditos,
      preco_centavos: pacote.preco_centavos,
      asaas_customer_id: customerId,
      status: "pendente",
    })
    .select("id")
    .single();
  if (error || !compra) throw new Error("Não foi possível registrar a compra.");

  const cobranca = await criarCobranca({
    customerId,
    valorCentavos: pacote.preco_centavos,
    descricao: `${pacote.quantidade_creditos} créditos — ${pacote.nome}`,
    externalReference: compra.id,
  });

  await sb
    .from("credit_purchases")
    .update({ asaas_payment_id: cobranca.id, invoice_url: cobranca.invoiceUrl })
    .eq("id", compra.id);

  return { invoiceUrl: cobranca.invoiceUrl };
}

/**
 * Chamado pelo webhook do Asaas quando um pagamento é confirmado.
 * Idempotente: só credita se a compra ainda estiver `pendente` — o Asaas
 * pode reenviar o mesmo evento mais de uma vez (entrega "at least once").
 * Usa sempre o cliente admin (webhook não tem sessão de usuário).
 */
export async function marcarCompraPaga(asaasPaymentId: string): Promise<boolean> {
  const sbAdmin = createAdminClient();

  const { data: compra } = await sbAdmin
    .from("credit_purchases")
    .select("id, user_id, quantidade_creditos, status")
    .eq("asaas_payment_id", asaasPaymentId)
    .maybeSingle();
  if (!compra || compra.status !== "pendente") return false;

  // .eq("status", "pendente") de novo aqui é o que torna isso seguro contra
  // entrega duplicada do webhook: se outra chamada já tiver marcado como
  // "pago" entre a leitura acima e este update, a cláusula WHERE não bate
  // com nenhuma linha e `data` volta vazio — não credita duas vezes.
  const { data: atualizado, error } = await sbAdmin
    .from("credit_purchases")
    .update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", compra.id)
    .eq("status", "pendente")
    .select("id");
  if (error || !atualizado?.length) return false;

  await sbAdmin.rpc("increment_creditos", { p_user_id: compra.user_id, p_delta: compra.quantidade_creditos });
  return true;
}
