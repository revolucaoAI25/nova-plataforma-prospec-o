import { enrollTargets, obterCampanha } from "@/lib/dispatch-db";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Inscreve o lote recebido numa campanha de disparo já existente. O envio
 * de fato continua depois, de forma independente, pela fila de disparo já
 * existente (tickDispatch, a cada 15s) — o fluxo não espera cada mensagem
 * ser entregue, só a inscrição.
 */
export async function executarDisparoWhatsapp(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const campaignId = String(config.campaignId || "");
  if (!campaignId) return { status: "erro", erro: "Selecione uma campanha de disparo WhatsApp." };

  const campanha = await obterCampanha(sb, campaignId);
  if (!campanha || campanha.user_id !== userId) return { status: "erro", erro: "Campanha de disparo não encontrada." };

  const lote = contexto.lote || [];
  if (!lote.length) {
    return { status: "concluido", leadsEntrada: 0, leadsSaida: 0, detalhe: { campaignId, inscritos: 0 } };
  }

  const resultado = await enrollTargets(sb, campaignId, lote as Array<{ nome?: string; telefone?: string }>);

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: resultado.inscritos,
    detalhe: { campaignId, ...resultado },
    contextoPatch: { campaignId },
  };
}
