import type { SupabaseClient } from "@supabase/supabase-js";
import { selecionarChaveApify, registrarUsoApify } from "@/lib/credits";
import type { Profile } from "@/lib/database.types";

export interface ChaveApifyResolvida {
  key: string;
  source: "own" | "pool" | "admin" | "env" | "none";
  poolIdx: number;
  bloqueado: boolean;
}

/**
 * Resolve qual chave Apify usar: chave própria > pool administrado (com
 * rodízio) > chave administrada individualmente > chave padrão da
 * plataforma. Usada por Instagram e pelo fallback de Google Maps → Apify.
 */
export function resolverChaveApify(profile: Profile): ChaveApifyResolvida {
  if (profile.apify_api_key) {
    return { key: profile.apify_api_key, source: "own", poolIdx: -1, bloqueado: false };
  }

  if (profile.apify_keys_pool?.length) {
    const r = selecionarChaveApify(profile.apify_keys_pool);
    if (r.key) return { key: r.key, source: "pool", poolIdx: r.index, bloqueado: false };
    const overflow = selecionarChaveApify(profile.apify_keys_pool, true);
    if (overflow.key) return { key: overflow.key, source: "pool", poolIdx: overflow.index, bloqueado: false };
    return { key: "", source: "pool", poolIdx: -1, bloqueado: true };
  }

  if (profile.apify_api_key_admin) {
    return { key: profile.apify_api_key_admin, source: "admin", poolIdx: -1, bloqueado: false };
  }

  if (process.env.APIFY_API_KEY) {
    return { key: process.env.APIFY_API_KEY, source: "env", poolIdx: -1, bloqueado: false };
  }

  return { key: "", source: "none", poolIdx: -1, bloqueado: false };
}

export async function registrarUsoChaveApify(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  resolucao: ChaveApifyResolvida,
  calls: number,
): Promise<void> {
  if (resolucao.source !== "pool" || resolucao.poolIdx < 0) return;
  const novoPool = registrarUsoApify(profile.apify_keys_pool, resolucao.poolIdx, calls);
  await supabase.from("profiles").update({ apify_keys_pool: novoPool }).eq("id", userId);
}
