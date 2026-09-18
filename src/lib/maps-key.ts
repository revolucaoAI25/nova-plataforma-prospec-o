import type { SupabaseClient } from "@supabase/supabase-js";
import { selecionarChaveMaps, registrarUsoMaps } from "@/lib/credits";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MapsKeyPoolEntry, Profile } from "@/lib/database.types";

export interface ChaveMapsResolvida {
  key: string;
  source: "own" | "pool" | "trial" | "admin" | "env" | "none";
  poolIdx: number;
  bloqueado: boolean;
}

async function obterPoolTeste(): Promise<MapsKeyPoolEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("platform_settings").select("maps_pool_teste").eq("id", 1).single();
  return (data?.maps_pool_teste as MapsKeyPoolEntry[]) || [];
}

async function salvarPoolTeste(pool: MapsKeyPoolEntry[]): Promise<void> {
  const admin = createAdminClient();
  await admin.from("platform_settings").update({ maps_pool_teste: pool }).eq("id", 1);
}

/**
 * Resolve qual chave Google Maps usar para este usuário, na mesma ordem de
 * prioridade do produto atual (app.py `pagina_busca`, linhas ~1116-1352):
 * contas de teste sempre usam o pool compartilhado da plataforma (nunca
 * configuram chave própria). Contas normais: o POOL (com rodízio) tem
 * prioridade sempre que tiver ao menos uma chave disponível dentro do mês —
 * a chave única só é usada como fallback quando o pool está vazio ou todas
 * as chaves do pool já esgotaram o limite do mês. Essa chave única também
 * depende do modo da conta: `maps_api_key_admin` quando `maps_credits_enabled`
 * (chave/pool administrados pela plataforma), senão `google_maps_api_key`
 * (chave própria do usuário). O overflow do pool (permitirOverflow) só entra
 * como penúltimo recurso — ver `resolverChaveMapsOverflow` abaixo, chamado
 * pelo caller somente depois de também esgotar o fallback Apify, igual ao
 * produto atual faz antes de estourar a cota normal do pool.
 */
export async function resolverChaveMaps(profile: Profile): Promise<ChaveMapsResolvida> {
  if (profile.conta_teste) {
    const poolTeste = await obterPoolTeste();
    const r = selecionarChaveMaps(poolTeste);
    if (r.key) return { key: r.key, source: "trial", poolIdx: r.index, bloqueado: false };
    return { key: "", source: "trial", poolIdx: -1, bloqueado: true };
  }

  const chaveUnica = profile.maps_credits_enabled
    ? profile.maps_api_key_admin || ""
    : profile.google_maps_api_key || "";
  const sourceUnica: ChaveMapsResolvida["source"] = profile.maps_credits_enabled ? "admin" : "own";

  if (profile.maps_keys_pool?.length) {
    const primeira = selecionarChaveMaps(profile.maps_keys_pool);
    if (primeira.key) {
      return { key: primeira.key, source: "pool", poolIdx: primeira.index, bloqueado: false };
    }
    // Pool esgotado neste mês: cai na chave única, se houver uma configurada.
    if (chaveUnica) {
      return { key: chaveUnica, source: sourceUnica, poolIdx: -1, bloqueado: false };
    }
    return { key: "", source: "pool", poolIdx: -1, bloqueado: true };
  }

  if (chaveUnica) {
    return { key: chaveUnica, source: sourceUnica, poolIdx: -1, bloqueado: false };
  }

  if (process.env.GOOGLE_MAPS_API_KEY) {
    return { key: process.env.GOOGLE_MAPS_API_KEY, source: "env", poolIdx: -1, bloqueado: false };
  }

  return { key: "", source: "none", poolIdx: -1, bloqueado: false };
}

/**
 * Último recurso quando o pool esgotou E não há chave única configurada E o
 * fallback Apify também não tem chave disponível: se o usuário não optou por
 * "pausar ao esgotar" (maps_pausar_ao_esgotar), estoura o limite mensal
 * usando a última chave do pool mesmo assim, em vez de falhar a busca. Só
 * deve ser chamado pelo caller depois de checar `resolverChaveApify` — mesma
 * ordem do produto atual (Apify tem prioridade sobre estourar o pool).
 */
export async function resolverChaveMapsOverflow(profile: Profile): Promise<ChaveMapsResolvida> {
  if (profile.maps_pausar_ao_esgotar) return { key: "", source: "pool", poolIdx: -1, bloqueado: true };
  const pool = profile.conta_teste ? await obterPoolTeste() : profile.maps_keys_pool;
  if (!pool?.length) return { key: "", source: "pool", poolIdx: -1, bloqueado: true };
  const overflow = selecionarChaveMaps(pool, true);
  if (!overflow.key) return { key: "", source: "pool", poolIdx: -1, bloqueado: true };
  return { key: overflow.key, source: profile.conta_teste ? "trial" : "pool", poolIdx: overflow.index, bloqueado: false };
}

/** Persiste o uso da chave no pool (do usuário ou compartilhado de teste), se a resolução veio de um pool. */
export async function registrarUsoChaveMaps(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  resolucao: ChaveMapsResolvida,
  calls: number,
  textSearchCalls: number,
): Promise<void> {
  if (resolucao.poolIdx < 0) return;
  if (resolucao.source === "trial") {
    const poolTeste = await obterPoolTeste();
    await salvarPoolTeste(registrarUsoMaps(poolTeste, resolucao.poolIdx, calls, textSearchCalls));
    return;
  }
  if (resolucao.source !== "pool") return;
  const novoPool = registrarUsoMaps(profile.maps_keys_pool, resolucao.poolIdx, calls, textSearchCalls);
  await supabase.from("profiles").update({ maps_keys_pool: novoPool }).eq("id", userId);
}
