import { enrollTargets, obterCampanha, perfilComDisparoHabilitado } from "@/lib/dispatch-db";
import { comTelefoneDeDestino, DESTINOS_TELEFONE, type DestinoTelefone } from "@/lib/phone";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";
import { avisoDaInscricao, opcoesInscricaoDoNo, saidasDaInscricao, aplicarMapeamentoVariaveis } from "./disparo-comum";

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

  // Fluxo pode ter sido criado antes de um admin revogar o flag do
  // usuário — reconfirma a cada execução, não só na hora de montar o nó.
  if (!(await perfilComDisparoHabilitado(sb, userId))) {
    return { status: "erro", erro: "Disparo por WhatsApp não está mais habilitado para sua conta." };
  }

  const lote = aplicarMapeamentoVariaveis(contexto.lote || [], config);
  if (!lote.length) {
    return { status: "concluido", leadsEntrada: 0, leadsSaida: 0, detalhe: { campaignId, inscritos: 0 } };
  }

  // Telefone escolhido no nó (celular do sócio, telefone da empresa…). Quem
  // não tem esse telefone não é inscrito e sai por "Falhou" com o motivo.
  const destino: DestinoTelefone = DESTINOS_TELEFONE.some((d) => d.id === config.telefoneDestino)
    ? (config.telefoneDestino as DestinoTelefone)
    : "padrao";
  const comDestino = lote.map((l) => comTelefoneDeDestino(l as Record<string, unknown>, destino));
  const semTelefone = destino === "padrao" ? [] : comDestino.filter((l) => !String(l.telefone ?? "").trim());
  const aInscrever = destino === "padrao" ? comDestino : comDestino.filter((l) => String(l.telefone ?? "").trim());

  const { leadsInvalidos, ...resultado } = await enrollTargets(sb, campaignId, aInscrever as Array<{ nome?: string; telefone?: string }>, opcoesInscricaoDoNo(ctx));
  let saidas = saidasDaInscricao(leadsInvalidos, "telefone");
  const motivoSem = destino === "socio" ? "Sem celular do sócio" : destino === "segundo" ? "Sem segundo telefone" : "Sem telefone da empresa";
  if (semTelefone.length && ctx.saidasConectadas.includes("falhou")) {
    const falhou = semTelefone.map((l) => ({ ...l, resultado_disparo: "falhou", motivo_falha: motivoSem, contato_que_falhou: "" }));
    saidas = { ...saidas, falhou: [...(saidas?.falhou ?? []), ...falhou] };
  }

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: resultado.inscritos,
    detalhe: {
      campaignId, ...resultado,
      ...(semTelefone.length ? { semTelefoneEscolhido: semTelefone.length } : {}),
      aviso: avisoDaInscricao(String(campanha.status), aInscrever.length, resultado)
        ?? (semTelefone.length ? `${semTelefone.length} lead(s) ficaram de fora: ${motivoSem.toLowerCase()}.` : undefined),
    },
    contextoPatch: { campaignId },
    saidas,
  };
}
