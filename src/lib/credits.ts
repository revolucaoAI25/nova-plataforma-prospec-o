import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcaoCredito, Profile } from "@/lib/database.types";

// Lógica de créditos — portada de modules/database.py do produto atual. Ver seção 5.5 do plano:
// créditos são debitados pelo que foi ENCONTRADO, não pelo que foi
// pedido; a pré-checagem reduz o limite pedido ao saldo disponível
// em vez de bloquear a busca inteira.
//
// Pool único (`profiles.creditos`) desde a migration 0013 — cada ação tem
// um peso em `credit_costs`, proporcional ao custo real de mercado (busca
// LinkedIn custa ~12x mais que busca CNPJ, por exemplo), em vez da taxa
// uniforme de 1 crédito/lead que o produto tinha antes disso.

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return (data as Profile) ?? null;
}

/** Custo em créditos de 1 unidade da ação (ex: 1 lead de LinkedIn) — cacheado em memória do processo, já que muda raramente e é lido em todo request de busca/enriquecimento. */
const cacheCusto = new Map<AcaoCredito, { valor: number; expiraEm: number }>();
const CACHE_TTL_MS = 60_000;

export async function custoAcao(supabase: SupabaseClient, acao: AcaoCredito): Promise<number> {
  const cached = cacheCusto.get(acao);
  if (cached && cached.expiraEm > Date.now()) return cached.valor;

  const { data } = await supabase.from("credit_costs").select("custo").eq("acao", acao).single();
  const valor = data?.custo ?? 1;
  cacheCusto.set(acao, { valor, expiraEm: Date.now() + CACHE_TTL_MS });
  return valor;
}

/**
 * Busca vários custos de uma vez (1 query) — usado pelas páginas de busca
 * pra mostrar "até X créditos" antes do usuário disparar a ação (pedido
 * explícito: o custo em créditos não estava visível em lugar nenhum antes
 * de rodar a busca).
 */
export async function custosVisiveis(
  supabase: SupabaseClient,
  acoes: AcaoCredito[],
): Promise<Record<string, number>> {
  const { data } = await supabase.from("credit_costs").select("acao, custo").in("acao", acoes);
  const mapa: Record<string, number> = {};
  for (const acao of acoes) mapa[acao] = 1;
  for (const row of data ?? []) mapa[row.acao] = row.custo;
  return mapa;
}

/** Debita `quantidade` unidades de `acao` do pool único, atomicamente via RPC — evita race condition entre buscas concorrentes. */
export async function debitarCreditos(
  supabase: SupabaseClient,
  userId: string,
  acao: AcaoCredito,
  quantidade: number,
): Promise<void> {
  if (quantidade <= 0) return;
  const custo = await custoAcao(supabase, acao);
  await supabase.rpc("decrement_creditos", { p_user_id: userId, p_delta: quantidade * custo });
}
