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
 *
 * O overflow do pool (estourar o limite mensal da última chave) respeita a
 * mesma preferência global "ao esgotar o limite" usada pelo Maps
 * (maps_pausar_ao_esgotar — a própria tela de Configurações já avisa que
 * vale "para Google Maps e Apify juntos"). Diferente do Maps, o Apify nunca
 * fica "bloqueado" de vez: quando o pool esgota e a preferência é pausar,
 * simplesmente cai pra chave administrada/padrão da plataforma abaixo, tal
 * qual o produto atual faz na aba Instagram (`if not _apify_key: _apify_key
 * = _s("APIFY_API_KEY")`, sem checar pausar_ao_esgotar nesse fallback final).
 */
export function resolverChaveApify(profile: Profile): ChaveApifyResolvida {
  if (profile.apify_api_key) {
    return { key: profile.apify_api_key, source: "own", poolIdx: -1, bloqueado: false };
  }

  if (profile.apify_keys_pool?.length) {
    const r = selecionarChaveApify(profile.apify_keys_pool);
    if (r.key) return { key: r.key, source: "pool", poolIdx: r.index, bloqueado: false };
    if (!profile.maps_pausar_ao_esgotar) {
      const overflow = selecionarChaveApify(profile.apify_keys_pool, true);
      if (overflow.key) return { key: overflow.key, source: "pool", poolIdx: overflow.index, bloqueado: false };
    }
    // Pool esgotado (ou overflow bloqueado pela preferência) — cai para a
    // chave administrada/padrão abaixo em vez de travar a busca.
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
