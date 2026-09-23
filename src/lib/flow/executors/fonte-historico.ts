import { buscarLeadsDaPesquisa } from "@/lib/db";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/** Usa uma pesquisa já existente do Histórico como ponto de partida do fluxo, sem nova extração. */
export async function executarFonteHistorico(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, node } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const searchId = String(config.searchId || "");
  if (!searchId) return { status: "erro", erro: "Selecione uma pesquisa do Histórico." };

  const leads = await buscarLeadsDaPesquisa(sb, searchId);
  if (!leads.length) return { status: "erro", erro: "A pesquisa selecionada não tem leads (ou não pertence a você)." };

  return {
    status: "concluido",
    leadsSaida: leads.length,
    detalhe: { searchId },
    contextoPatch: { searchId, lote: leads as unknown as Record<string, unknown>[] },
  };
}
