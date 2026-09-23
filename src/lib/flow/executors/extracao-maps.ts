import { getProfile, debitarCreditos } from "@/lib/credits";
import { resolverChaveMaps, resolverChaveMapsOverflow, registrarUsoChaveMaps } from "@/lib/maps-key";
import { resolverChaveApify, registrarUsoChaveApify } from "@/lib/apify-key";
import { buscarMaps, QuotaExceededError } from "@/lib/integrations/google-maps";
import { buscarApifyMaps } from "@/lib/integrations/apify-maps";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes } from "@/lib/db";
import { NICHOS } from "@/lib/data/nichos";
import { ESTADOS } from "@/lib/data/estados";
import type { Json } from "@/lib/database.types";
import type { Lead } from "@/lib/types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

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

  if (cidades.length && estados.length !== 1) {
    return { status: "erro", erro: "Selecione vários estados só quando 'cidades' estiver vazio. Com cidade(s), informe exatamente um estado." };
  }
  const localidades = cidades.length
    ? cidades.map((c) => `${c}, ${ESTADOS[estados[0]] ?? estados[0]}`)
    : estados.map((uf) => ESTADOS[uf] ?? uf);
  if (!localidades.length) return { status: "erro", erro: "Informe ao menos uma cidade ou um estado." };

  const profile = await getProfile(sb, userId);
  if (!profile) return { status: "erro", erro: "Perfil não encontrado." };

  const { telefones } = apenasNovos ? await buscarIdentificadoresExistentes(sb, userId) : { telefones: new Set<string>() };

  let resolucaoMaps = await resolverChaveMaps(profile);
  const resolucaoApify = resolverChaveApify(profile);
  if ((resolucaoMaps.bloqueado || !resolucaoMaps.key) && !resolucaoApify.key) {
    const overflow = await resolverChaveMapsOverflow(profile);
    if (overflow.key) resolucaoMaps = overflow;
  }

  const params = {
    queryBase, localidade: localidades, limite,
    nicho: nicho || queryBase, subnicho,
    excludePhones: telefones, showPhone, showRating,
  };

  let resultados: Lead[] = [];
  let usouApify = false;
  try {
    if (resolucaoMaps.key && !resolucaoMaps.bloqueado) {
      const stats = { text_search_calls: 0, contact_data_calls: 0 };
      try {
        resultados = await buscarMaps({ ...params, apiKey: resolucaoMaps.key, stats });
        await registrarUsoChaveMaps(sb, userId, profile, resolucaoMaps, resultados.length, stats.text_search_calls);
      } catch (e) {
        if (e instanceof QuotaExceededError && resolucaoApify.key) {
          usouApify = true;
          resultados = await buscarApifyMaps({ ...params, apiKey: resolucaoApify.key });
        } else {
          throw e;
        }
      }
    } else if (resolucaoApify.key) {
      usouApify = true;
      resultados = await buscarApifyMaps({ ...params, apiKey: resolucaoApify.key });
    } else {
      return { status: "erro", erro: "Nenhuma chave Google Maps/Apify configurada." };
    }
  } catch (e) {
    return { status: "erro", erro: (e as Error).message };
  }
  if (usouApify && resolucaoApify.source === "pool") {
    await registrarUsoChaveApify(sb, userId, profile, resolucaoApify, resultados.length);
  }

  const total = resultados.length;
  const localidadeLabel = localidades.join(", ");
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
  if (profile.maps_credits_enabled && total > 0 && (!usouApify || resolucaoApify.source === "pool")) {
    await debitarCreditos(sb, userId, "maps_credits", total);
  }

  return {
    status: "concluido",
    leadsSaida: total,
    detalhe: { searchId: searchId || null, usouApify },
    contextoPatch: { searchId: searchId || undefined, lote: resultados as unknown as Record<string, unknown>[] },
  };
}
