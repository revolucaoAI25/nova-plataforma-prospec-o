import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Nó assíncrono de pacing: na primeira visita calcula `liberadoEm` e
 * devolve `aguardando_subprocesso`; nos ticks seguintes só compara com
 * agora — mesmo padrão multi-tick do enriquecimento_ia, só que sem
 * subprocesso nenhum (o próprio motor cuida da espera via `contexto`).
 */
export async function executarEspera(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const minutos = Number(config.minutos ?? 60);
  const lote = contexto.lote || [];

  const liberadoEmExistente = contexto.esperaLiberadoEm as string | undefined;
  if (!liberadoEmExistente) {
    const liberadoEm = new Date(Date.now() + minutos * 60_000).toISOString();
    return {
      status: "aguardando_subprocesso",
      detalhe: { liberadoEm },
      contextoPatch: { esperaLiberadoEm: liberadoEm },
    };
  }

  if (new Date(liberadoEmExistente) > new Date()) {
    return { status: "aguardando_subprocesso", detalhe: { liberadoEm: liberadoEmExistente } };
  }

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: lote.length,
    detalhe: { liberadoEm: liberadoEmExistente },
    // Limpa a marca — se esse mesmo nó for revisitado numa run futura (não
    // deveria, mas por segurança), recalcula do zero em vez de reusar a
    // data antiga já vencida.
    contextoPatch: { esperaLiberadoEm: undefined },
  };
}
