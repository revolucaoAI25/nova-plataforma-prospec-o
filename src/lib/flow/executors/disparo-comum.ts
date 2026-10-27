import type { OpcoesInscricao } from "@/lib/origem-fluxo";
import { capitalizar, nomeEmpresa, primeiroNome } from "@/lib/mensagem";
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

/**
 * "De onde vem cada variável" do nó: copia o campo escolhido para a
 * variável da mensagem antes de inscrever (o snapshot do alvo leva o valor).
 * As variáveis prontas recebem o mesmo tratamento de sempre (primeiro nome,
 * nome da empresa sem LTDA, cidade capitalizada). Campo vazio no lead: não
 * mexe, e a mensagem segue a regra normal (padrão ou some).
 */
export function aplicarMapeamentoVariaveis<T extends Record<string, unknown>>(lote: T[], config: Record<string, unknown>): T[] {
  const mapa = (config.mapeamentoVariaveis ?? {}) as Record<string, string>;
  const pares = Object.entries(mapa).filter(([variavel, campo]) => variavel && campo && campo.trim());
  if (!pares.length) return lote;
  const tratar: Record<string, (v: string) => string> = { primeiro_nome: primeiroNome, empresa: nomeEmpresa, cidade: capitalizar };
  return lote.map((lead) => {
    const novo: Record<string, unknown> = { ...lead };
    for (const [variavel, campo] of pares) {
      const bruto = lead[campo.trim()];
      const valor = bruto === null || bruto === undefined ? "" : String(bruto).trim();
      if (valor) novo[variavel] = tratar[variavel] ? tratar[variavel](valor) : valor;
    }
    return novo as T;
  });
}
