import type { SupabaseClient } from "@supabase/supabase-js";
import { selecionarChaveMaps, registrarUsoMaps } from "@/lib/credits";
import type { Profile } from "@/lib/database.types";

export interface ChaveMapsResolvida {
  key: string;
  source: "own" | "pool" | "env" | "none";
  poolIdx: number;
  bloqueado: boolean;
}

/**
 * Resolve qual chave Google Maps usar para este usuário, na mesma ordem de
 * prioridade do produto atual: chave própria > pool administrado (com
 * rodízio) > chave padrão da plataforma. Quando o pool esgota, respeita a
 * preferência "pausar ao esgotar" (maps_pausar_ao_esgotar).
 */
export function resolverChaveMaps(profile: Profile): ChaveMapsResolvida {
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

/** Persiste o uso da chave no pool do usuário, se a resolução veio do pool. */
export async function registrarUsoChaveMaps(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  resolucao: ChaveMapsResolvida,
  calls: number,
  textSearchCalls: number,
): Promise<void> {
  if (resolucao.source !== "pool" || resolucao.poolIdx < 0) return;
  const novoPool = registrarUsoMaps(profile.maps_keys_pool, resolucao.poolIdx, calls, textSearchCalls);
  await supabase.from("profiles").update({ maps_keys_pool: novoPool }).eq("id", userId);
}
