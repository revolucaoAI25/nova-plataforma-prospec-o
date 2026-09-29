import { resolverChaveMaps } from "@/lib/maps-key";
import { resolverChaveApify } from "@/lib/apify-key";
import type { Profile } from "@/lib/database.types";

/**
 * Traduz a fonte resolvida de uma chave (own/pool/admin/env/trial/none) pra
 * texto explicativo — usado só na tela de admin, nunca no fluxo de busca em
 * si (que só precisa da chave, não da explicação de onde ela veio).
 */
const SOURCE_LABEL: Record<string, string> = {
  own: "Chave própria do usuário (Configurações)",
  pool: "Pool administrado (rodízio automático)",
  admin: "Chave administrada (única, definida aqui)",
  env: "Chave padrão da plataforma (variável de ambiente)",
  trial: "Pool compartilhado de contas de teste",
  none: "Nenhuma configurada",
};

function mascarar(key: string): string {
  if (!key) return "";
  if (key.length <= 6) return "••••";
  return `••••${key.slice(-4)}`;
}

export interface ResumoFonteChave {
  source: string;
  label: string;
  mascarada: string;
  bloqueado: boolean;
}

export interface ResumoChavesUsuario {
  cnpj: ResumoFonteChave;
  maps: ResumoFonteChave;
  apify: ResumoFonteChave;
}

/**
 * Resolve, pra este usuário AGORA, qual fonte de chave cada busca realmente
 * usaria — mesma lógica de resolução usada de verdade nas rotas de busca
 * (resolverChaveMaps/resolverChaveApify + a checagem inline de CNPJ), só
 * que aqui só devolve a explicação (fonte + últimos 4 dígitos mascarados),
 * nunca a chave inteira. `apify` cobre Instagram, LinkedIn e o fallback de
 * Maps — os três usam a mesma resolução (uma chave Apify por usuário).
 */
export async function resolverResumoChaves(profile: Profile): Promise<ResumoChavesUsuario> {
  const cddKey = profile.cdd_api_key || profile.cdd_api_key_admin || process.env.CDD_API_KEY || "";
  const cddSource = profile.cdd_api_key ? "own" : profile.cdd_api_key_admin ? "admin" : process.env.CDD_API_KEY ? "env" : "none";

  const maps = await resolverChaveMaps(profile);
  const apify = resolverChaveApify(profile);

  return {
    cnpj: { source: cddSource, label: SOURCE_LABEL[cddSource], mascarada: mascarar(cddKey), bloqueado: false },
    maps: { source: maps.source, label: SOURCE_LABEL[maps.source] || maps.source, mascarada: mascarar(maps.key), bloqueado: maps.bloqueado },
    apify: { source: apify.source, label: SOURCE_LABEL[apify.source] || apify.source, mascarada: mascarar(apify.key), bloqueado: apify.bloqueado },
  };
}
