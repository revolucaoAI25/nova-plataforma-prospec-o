import type { SupabaseClient } from "@supabase/supabase-js";
import { selecionarChaveMaps, registrarUsoMaps } from "@/lib/credits";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MapsKeyPoolEntry, Profile } from "@/lib/database.types";

export interface ChaveMapsResolvida {
  key: string;
  source: "own" | "pool" | "trial" | "env" | "none";
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
 * prioridade do produto atual: contas de teste sempre usam o pool
 * compartilhado da plataforma (nunca configuram chave própria); contas
 * normais usam chave própria > pool administrado (com rodízio) > chave
 * padrão da plataforma. Quando o pool esgota, respeita a preferência
 * "pausar ao esgotar" (maps_pausar_ao_esgotar).
 */
export async function resolverChaveMaps(profile: Profile): Promise<ChaveMapsResolvida> {
  if (profile.conta_teste) {
    const poolTeste = await obterPoolTeste();
    const r = selecionarChaveMaps(poolTeste);
    if (r.key) return { key: r.key, source: "trial", poolIdx: r.index, bloqueado: false };
    return { key: "", source: "trial", poolIdx: -1, bloqueado: true };
  }

  if (profile.google_maps_api_key) {
    return { key: profile.google_maps_api_key, source: "own", poolIdx: -1, bloqueado: false };
  }

  if (profile.maps_keys_pool?.length) {
    const primeira = selecionarChaveMaps(profile.maps_keys_pool);
    if (primeira.key) {
      return { key: primeira.key, source: "pool", poolIdx: primeira.index, bloqueado: false };
    }
    if (profile.maps_pausar_ao_esgotar) {
      return { key: "", source: "pool", poolIdx: -1, bloqueado: true };
    }
    const overflow = selecionarChaveMaps(profile.maps_keys_pool, true);
    if (overflow.key) {
      return { key: overflow.key, source: "pool", poolIdx: overflow.index, bloqueado: false };
    }
    return { key: "", source: "pool", poolIdx: -1, bloqueado: true };
  }

  if (process.env.GOOGLE_MAPS_API_KEY) {
    return { key: process.env.GOOGLE_MAPS_API_KEY, source: "env", poolIdx: -1, bloqueado: false };
  }

  return { key: "", source: "none", poolIdx: -1, bloqueado: false };
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
