/**
 * De qual fluxo/nó/execução um alvo de disparo veio. Só é gravado quando o
 * nó de disparo tem saídas por resultado ligadas ("Enviou", "Falhou"...) —
 * é o que permite devolver o lead ao fluxo conforme a campanha anda (ver
 * src/lib/flow/saidas-disparo.ts).
 */
export interface OrigemFluxo {
  flowId: string;
  nodeId: string;
  runId: string;
}

export interface OpcoesInscricao {
  origemFluxo?: OrigemFluxo;
  /** Devolve em `leadsInvalidos` os leads sem contato válido (pra saída "Falhou" do fluxo). */
  coletarInvalidos?: boolean;
}

export function colunasOrigemFluxo(origem?: OrigemFluxo): Record<string, string> {
  return origem ? { flow_id: origem.flowId, flow_node_id: origem.nodeId, flow_run_id: origem.runId } : {};
}
