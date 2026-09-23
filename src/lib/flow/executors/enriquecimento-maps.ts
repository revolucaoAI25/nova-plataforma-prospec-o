import { getProfile } from "@/lib/credits";
import { resolverChaveMaps, resolverChaveMapsOverflow, registrarUsoChaveMaps } from "@/lib/maps-key";
import { enriquecerComMaps, QuotaExceededError, MapsAccessError } from "@/lib/integrations/google-maps";
import type { Lead } from "@/lib/types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Generaliza o `mapsModo` embutido na busca CNPJ avulsa (enriquecerComMaps)
 * pra qualquer lote do fluxo, não só CNPJ — pode vir de extração Maps,
 * Instagram, LinkedIn ou do histórico. Cruza cada lead pelo nome +
 * município/UF já presentes no lote; sem nome, o lead é mantido sem
 * alteração (não há o que buscar).
 */
export async function executarEnriquecimentoMaps(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const showPhone = config.showPhone !== false;
  const filtrar = Boolean(config.filtrar);
  const minAvaliacoes = Number(config.minAvaliacoes ?? 0);

  const lote = contexto.lote || [];
  if (!lote.length) return { status: "concluido", leadsEntrada: 0, leadsSaida: 0 };

  const profile = await getProfile(sb, userId);
  if (!profile) return { status: "erro", erro: "Perfil não encontrado." };

  let resolucao = await resolverChaveMaps(profile);
  if (resolucao.bloqueado || !resolucao.key) {
    const overflow = await resolverChaveMapsOverflow(profile);
    if (overflow.key) resolucao = overflow;
  }
  if (!resolucao.key || resolucao.bloqueado) {
    return { status: "erro", erro: "Nenhuma chave Google Maps disponível (limite mensal atingido ou não configurada)." };
  }

  const stats = { text_search_calls: 0, contact_data_calls: 0 };
  let resultados: Lead[];
  try {
    resultados = await enriquecerComMaps({
      resultados: lote as unknown as Lead[],
      apiKey: resolucao.key,
      showPhone,
      filtrar,
      minAvaliacoes,
      stats,
    });
  } catch (e) {
    if (e instanceof QuotaExceededError || e instanceof MapsAccessError) return { status: "erro", erro: e.message };
    return { status: "erro", erro: (e as Error).message };
  }
  await registrarUsoChaveMaps(sb, userId, profile, resolucao, stats.contact_data_calls, stats.text_search_calls);

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: resultados.length,
    detalhe: { verificados: lote.length, mantidos: resultados.length },
    contextoPatch: { lote: resultados as unknown as Record<string, unknown>[] },
  };
}
