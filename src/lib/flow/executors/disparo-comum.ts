import type { OpcoesInscricao } from "@/lib/origem-fluxo";
import { SAIDAS_DISPARO } from "../node-types";
import type { FlowExecutorContext, LotesPorSaida } from "../executor-types";

// Comum aos três nós de disparo: como inscrever quando o nó tem saídas por
// resultado ligadas (ver src/lib/flow/saidas-disparo.ts).

const SAIDAS_RESULTADO = new Set(SAIDAS_DISPARO.map((s) => s.id));

/** Grava a origem no alvo só se alguma saída por resultado estiver ligada. */
export function opcoesInscricaoDoNo(ctx: FlowExecutorContext): OpcoesInscricao {
  const usaResultados = ctx.saidasConectadas.some((s) => SAIDAS_RESULTADO.has(s));
  return {
    origemFluxo: usaResultados ? { flowId: ctx.flowId, nodeId: ctx.node.id, runId: ctx.runId } : undefined,
    coletarInvalidos: ctx.saidasConectadas.includes("falhou"),
  };
}

/** Quem nem chegou a ser inscrito por contato inválido sai por "Falhou" na hora. */
export function saidasDaInscricao(leadsInvalidos: object[] | undefined, campoContato: string): LotesPorSaida | undefined {
  if (!leadsInvalidos?.length) return undefined;
  return {
    falhou: leadsInvalidos.map((lead) => {
      const l = lead as Record<string, unknown>;
      return { ...l, resultado_disparo: "falhou", motivo_falha: "Contato inválido", contato_que_falhou: String(l[campoContato] ?? "") };
    }),
  };
}

/** Avisos que não impedem o passo, mas explicam por que nada vai sair (aparecem no histórico). */
export function avisoDaInscricao(
  statusCampanha: string,
  totalLote: number,
  r: { inscritos: number; invalidos: number; duplicados: number; opt_out: number },
): string | undefined {
  if (totalLote > 0 && r.inscritos + r.invalidos + r.duplicados + r.opt_out === 0) {
    return "A campanha não tem nenhuma etapa de mensagem: ninguém foi inscrito.";
  }
  if (statusCampanha !== "ativa" && r.inscritos > 0) {
    return `A campanha está "${statusCampanha}": os leads foram inscritos, mas só recebem mensagem quando ela for ativada.`;
  }
  return undefined;
}
