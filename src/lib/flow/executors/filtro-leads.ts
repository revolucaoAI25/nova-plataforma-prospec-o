import type { FiltroOperador } from "../node-types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

function bateCondicao(valorCampo: unknown, operador: FiltroOperador, valorEsperado: string): boolean {
  const texto = String(valorCampo ?? "").trim();
  const alvo = valorEsperado.trim();
  switch (operador) {
    case "preenchido":
      return texto.length > 0;
    case "vazio":
      return texto.length === 0;
    case "contem":
      return texto.toLowerCase().includes(alvo.toLowerCase());
    case "nao_contem":
      return !texto.toLowerCase().includes(alvo.toLowerCase());
    case "igual":
      return texto.toLowerCase() === alvo.toLowerCase();
    case "diferente":
      return texto.toLowerCase() !== alvo.toLowerCase();
    default:
      return true;
  }
}

/**
 * Mantém no lote só os leads que batem a condição — não ramifica (v1 é
 * grafo linear), só reduz. Útil depois de um enriquecimento (ex.: seguir só
 * com `enriquecimento_status = concluido`) ou pra qualquer outro corte
 * (`email` preenchido antes de um disparo, `uf` igual a um estado, etc.).
 */
export async function executarFiltroLeads(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const campo = String(config.campo || "").trim();
  const operador = (config.operador as FiltroOperador) || "preenchido";
  const valor = String(config.valor || "");
  if (!campo) return { status: "erro", erro: "Informe o campo a filtrar (ex.: email, enriquecimento_status)." };

  const lote = contexto.lote || [];
  const filtrados = lote.filter((lead) => bateCondicao(lead[campo], operador, valor));

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: filtrados.length,
    detalhe: { campo, operador, valor, removidos: lote.length - filtrados.length },
    contextoPatch: { lote: filtrados },
  };
}
