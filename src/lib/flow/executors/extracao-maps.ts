import { getProfile, debitarCreditos, custoAcao } from "@/lib/credits";
import { chaveApify } from "@/lib/platform-keys";
import { buscarApifyMaps } from "@/lib/integrations/apify-maps";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes } from "@/lib/db";
import { NICHOS } from "@/lib/data/nichos";
import { ESTADOS } from "@/lib/data/estados";
import type { Json } from "@/lib/database.types";
import type { Lead } from "@/lib/types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";
import { resolverRaioMaps } from "@/lib/raio-maps";

/** Espelha /api/search/maps/route.ts (catálogo de nichos + múltiplas cidades/estados). */
export async function executarExtracaoMaps(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;

  const nicho = String(config.nicho || "");
  const queryCustom = String(config.queryCustom || "");
  const subnicho = String(config.subnicho || "");
  const cidades = Array.isArray(config.cidades) ? (config.cidades as string[]) : [];
  const estados = Array.isArray(config.estados) ? (config.estados as string[]) : [];
  const showPhone = config.showPhone !== false;
  const showRating = config.showRating !== false;
  const apenasNovos = config.apenasNovos !== false;
  const limite = Number(config.limite ?? 60);

  const nichoInfo = NICHOS[nicho];
  const queryBase = (nichoInfo?.query || queryCustom).trim();
  if (!queryBase) return { status: "erro", erro: "Escolha um nicho do catálogo ou informe um termo de busca personalizado." };

  // Raio a partir de um endereço tem prioridade sobre cidades/estados.
  const raioEndereco = String(config.raioEndereco || "").trim();
  const raio = raioEndereco.length >= 3
    ? await resolverRaioMaps({
      endereco: raioEndereco,
      km: Math.min(Math.max(Number(config.raioKm) || 5, 1), 50),
      lat: typeof config.raioLat === "number" ? config.raioLat : undefined,
      lng: typeof config.raioLng === "number" ? config.raioLng : undefined,
    })
    : null;
  if (raioEndereco.length >= 3 && !raio) return { status: "erro", erro: `Não encontramos o endereço do raio ("${raioEndereco}").` };

  if (!raio && cidades.length && estados.length !== 1) {
    return { status: "erro", erro: "Selecione vários estados só quando 'cidades' estiver vazio. Com cidade(s), informe exatamente um estado." };
  }
  const localidades = cidades.length
    ? cidades.map((c) => `${c}, ${ESTADOS[estados[0]] ?? estados[0]}`)
    : estados.map((uf) => ESTADOS[uf] ?? uf);
  if (!raio && !localidades.length) return { status: "erro", erro: "Informe ao menos uma cidade ou um estado." };

  const profile = await getProfile(sb, userId);
  if (!profile) return { status: "erro", erro: "Perfil não encontrado." };
  const custo = await custoAcao(sb, "maps");
  if (profile.creditos < limite * custo) {
    return { status: "erro", erro: `Créditos insuficientes (${profile.creditos} disponíveis, até ${limite * custo} necessários).` };
  }

  const { telefones } = apenasNovos ? await buscarIdentificadoresExistentes(sb, userId) : { telefones: new Set<string>() };

  const apiKey = await chaveApify();
  if (!apiKey) return { status: "erro", erro: "Extração indisponível no momento (chave da plataforma não configurada)." };

  const params = {
    queryBase, localidade: raio ? raio.descricao : localidades, limite,
    ...(raio ? { raio, cidade: raio.cidade, estado: raio.uf } : {}),
    nicho: nicho || queryBase, subnicho,
    excludePhones: telefones, showPhone, showRating,
  };

  let resultados: Lead[];
  try {
    resultados = await buscarApifyMaps({ ...params, apiKey });
  } catch (e) {
    return { status: "erro", erro: (e as Error).message };
  }

  const total = resultados.length;
  const localidadeLabel = raio ? raio.descricao : localidades.join(", ");
  const searchId = await salvarPesquisa(sb, userId, {
    fonte: "google_maps",
    nicho: nicho || queryBase,
    subnicho,
    cidade: "",
    estado: "",
    localidade: localidadeLabel,
    totalResults: total,
    filtros: config as Json,
  });
  if (searchId && total) await salvarLeads(sb, userId, searchId, resultados);
  if (total > 0) {
    await debitarCreditos(sb, userId, "maps", total);
  }

  return {
    status: "concluido",
    leadsSaida: total,
    detalhe: { searchId: searchId || null },
    contextoPatch: { searchId: searchId || undefined, lote: resultados as unknown as Record<string, unknown>[] },
  };
}
