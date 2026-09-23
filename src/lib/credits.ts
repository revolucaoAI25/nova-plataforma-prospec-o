import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiKeyPoolEntry, MapsKeyPoolEntry, Profile } from "@/lib/database.types";

// Lógica de créditos e rodízio de chaves de API — portada de
// modules/database.py do produto atual. Ver seção 5.5 do plano:
// créditos são debitados pelo que foi ENCONTRADO, não pelo que foi
// pedido; a pré-checagem reduz o limite pedido ao saldo disponível
// em vez de bloquear a busca inteira.

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return (data as Profile) ?? null;
}

/** Debita créditos atomicamente via RPC — evita race condition entre buscas concorrentes. */
export async function debitarCreditos(
  supabase: SupabaseClient,
  userId: string,
  campo: "cdd_credits" | "maps_credits" | "instagram_credits" | "linkedin_credits",
  quantidade: number,
): Promise<void> {
  if (quantidade <= 0) return;
  await supabase.rpc("decrement_credits", { p_user_id: userId, p_campo: campo, p_delta: quantidade });
}

// Teto oculto de chamadas de Text Search por chave/mês — não é o limite
// visível que o cliente configura (esse é sobre Contact Data/telefone,
// ~1.000 grátis). Fica com margem de segurança abaixo do real (~5.000).
const TEXT_SEARCH_LIMITE_OCULTO = 4500;

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Seleciona a primeira chave Maps disponível no pool (dentro dos limites
 * visível e oculto), resetando contadores de meses anteriores. Retorna
 * (chave, índice, pool atualizado) — índice -1 se nenhuma disponível.
 */
export function selecionarChaveMaps(
  pool: MapsKeyPoolEntry[],
  permitirOverflow = false,
): { key: string; index: number; pool: MapsKeyPoolEntry[] } {
  const mes = mesAtual();
  const poolCopia = pool.map((k) => ({ ...k }));

  for (let i = 0; i < poolCopia.length; i++) {
    const entry = poolCopia[i];
    if (entry.month !== mes) {
      entry.usage = 0;
      entry.text_search_usage = 0;
      entry.month = mes;
    }
    const dentroVisivel = entry.usage < (entry.limit || 900);
    const dentroOculto = (entry.text_search_usage ?? 0) < TEXT_SEARCH_LIMITE_OCULTO;
    if (dentroVisivel && dentroOculto) {
      return { key: entry.key, index: i, pool: poolCopia };
    }
  }

  if (permitirOverflow && poolCopia.length) {
    const ultimo = poolCopia.length - 1;
    return { key: poolCopia[ultimo].key, index: ultimo, pool: poolCopia };
  }
  return { key: "", index: -1, pool: poolCopia };
}

export function registrarUsoMaps(
  pool: MapsKeyPoolEntry[],
  keyIdx: number,
  calls: number,
  textSearchCalls = 0,
): MapsKeyPoolEntry[] {
  const poolCopia = pool.map((k) => ({ ...k }));
  if (keyIdx >= 0 && keyIdx < poolCopia.length) {
    poolCopia[keyIdx].usage = (poolCopia[keyIdx].usage || 0) + calls;
    if (textSearchCalls) {
      poolCopia[keyIdx].text_search_usage = (poolCopia[keyIdx].text_search_usage || 0) + textSearchCalls;
    }
  }
  return poolCopia;
}

/**
 * Seleciona a primeira chave Apify disponível no mês atual (dentro do
 * limite). Retorna (chave, índice, pool, esgotado) — esgotado=true e sem
 * chave quando todas passaram do limite e permitirOverflow=false; pool
 * vazio não é "esgotado", é "não configurado".
 */
export function selecionarChaveApify(
  pool: ApiKeyPoolEntry[],
  permitirOverflow = false,
): { key: string; index: number; pool: ApiKeyPoolEntry[]; esgotado: boolean } {
  if (!pool.length) return { key: "", index: -1, pool, esgotado: false };
  const mes = mesAtual();
  const poolCopia = pool.map((k) => ({ ...k }));

  for (let i = 0; i < poolCopia.length; i++) {
    const entry = poolCopia[i];
    if (entry.month !== mes) {
      entry.usage = 0;
      entry.month = mes;
    }
    if (entry.usage < (entry.limit || 900)) {
      return { key: entry.key, index: i, pool: poolCopia, esgotado: false };
    }
  }

  if (permitirOverflow) {
    const ultimo = poolCopia.length - 1;
    return { key: poolCopia[ultimo].key, index: ultimo, pool: poolCopia, esgotado: true };
  }
  return { key: "", index: -1, pool: poolCopia, esgotado: true };
}

export function registrarUsoApify(pool: ApiKeyPoolEntry[], keyIdx: number, calls: number): ApiKeyPoolEntry[] {
  const poolCopia = pool.map((k) => ({ ...k }));
  if (keyIdx >= 0 && keyIdx < poolCopia.length) {
    poolCopia[keyIdx].usage = (poolCopia[keyIdx].usage || 0) + calls;
  }
  return poolCopia;
}
