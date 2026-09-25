import { enrollEmailTargets, obterCampanhaEmail } from "@/lib/email-dispatch-db";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Inscreve o lote recebido numa campanha de disparo por e-mail já
 * existente — mirror exato de executarDisparoWhatsapp. O envio de fato
 * continua depois, de forma independente, pela fila de disparo por
 * e-mail já existente (tickEmailDispatch, a cada 20s) — o fluxo não
 * espera cada e-mail ser entregue, só a inscrição.
 */
export async function executarDisparoEmail(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const campaignId = String(config.campaignId || "");
  if (!campaignId) return { status: "erro", erro: "Selecione uma campanha de disparo por e-mail." };

  const campanha = await obterCampanhaEmail(sb, campaignId);
  if (!campanha || campanha.user_id !== userId) return { status: "erro", erro: "Campanha de disparo por e-mail não encontrada." };

  const lote = contexto.lote || [];
  if (!lote.length) {
    return { status: "concluido", leadsEntrada: 0, leadsSaida: 0, detalhe: { campaignId, inscritos: 0 } };
  }

  const resultado = await enrollEmailTargets(sb, campaignId, lote as Array<{ nome?: string; email?: string }>);

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: resultado.inscritos,
    detalhe: { campaignId, ...resultado },
    contextoPatch: { campaignId },
  };
}
