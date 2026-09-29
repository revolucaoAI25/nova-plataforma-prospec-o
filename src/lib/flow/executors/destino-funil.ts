import { adicionarLeadsAoFunil } from "@/lib/funil-db";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Fluxo → Funil: deposita o lote recebido numa coluna de um Funil (Kanban).
 * Deliberadamente NÃO dispara o `fluxo_id` daquela coluna (isso só
 * acontece no arraste manual, ver src/lib/funil-db.ts `moverCard`) — senão
 * um fluxo que termina depositando na mesma coluna que ele é acionado por
 * criaria um loop.
 */
export async function executarDestinoFunil(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const funilId = String(config.funilId || "");
  const colunaId = String(config.colunaId || "");
  if (!funilId || !colunaId) return { status: "erro", erro: "Escolha o funil e a coluna de destino." };

  const lote = contexto.lote || [];
  if (!lote.length) {
    return { status: "concluido", leadsEntrada: 0, leadsSaida: 0, detalhe: { funilId, colunaId, adicionados: 0 } };
  }

  const total = await adicionarLeadsAoFunil(sb, funilId, colunaId, userId, lote);
  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: total,
    detalhe: { funilId, colunaId, adicionados: total },
  };
}
