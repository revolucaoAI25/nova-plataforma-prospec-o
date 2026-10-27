import { enrollLinkedInTargets, obterCampanhaLinkedin, perfilComLinkedinDisparoHabilitado } from "@/lib/linkedin-dispatch-db";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";
import { avisoDaInscricao, opcoesInscricaoDoNo, saidasDaInscricao, aplicarMapeamentoVariaveis } from "./disparo-comum";

/**
 * Inscreve o lote recebido numa campanha de disparo por LinkedIn já
 * existente — mirror exato de executarDisparoWhatsapp/executarDisparoEmail.
 * O envio de fato (pedido de conexão / mensagem) continua depois, de forma
 * independente, pela fila de disparo por LinkedIn já existente
 * (tickLinkedInDispatch) — o fluxo não espera cada ação ser executada, só
 * a inscrição.
 */
export async function executarDisparoLinkedin(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const campaignId = String(config.campaignId || "");
  if (!campaignId) return { status: "erro", erro: "Selecione uma campanha de disparo por LinkedIn." };

  const campanha = await obterCampanhaLinkedin(sb, campaignId);
  if (!campanha || campanha.user_id !== userId) return { status: "erro", erro: "Campanha de disparo por LinkedIn não encontrada." };

  // Fluxo pode ter sido criado antes de um admin revogar o flag do
  // usuário — reconfirma a cada execução, não só na hora de montar o nó.
  if (!(await perfilComLinkedinDisparoHabilitado(sb, userId))) {
    return { status: "erro", erro: "Disparo por LinkedIn não está mais habilitado para sua conta." };
  }

  const lote = aplicarMapeamentoVariaveis(contexto.lote || [], config);
  if (!lote.length) {
    return { status: "concluido", leadsEntrada: 0, leadsSaida: 0, detalhe: { campaignId, inscritos: 0 } };
  }

  const { leadsInvalidos, ...resultado } = await enrollLinkedInTargets(sb, campaignId, lote as Array<{ nome?: string; linkedin_url?: string }>, opcoesInscricaoDoNo(ctx));

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: resultado.inscritos,
    detalhe: { campaignId, ...resultado, aviso: avisoDaInscricao(String(campanha.status), lote.length, resultado) },
    contextoPatch: { campaignId },
    saidas: saidasDaInscricao(leadsInvalidos, "linkedin_url"),
  };
}
