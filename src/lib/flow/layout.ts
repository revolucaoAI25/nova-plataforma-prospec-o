import { FLOW_NODE_TYPES } from "./node-types";
import type { FlowNodeTipo } from "@/lib/database.types";

// Posições do construtor de fluxos em árvore, da esquerda pra direita: o
// caminho principal numa linha e cada ramo abaixo da sua saída. Usado pelo
// botão "Organizar" (com a altura real de cada cartão) e pelos fluxos
// criados pela IA (com a altura estimada).

export const PASSO_X = 300;
const ESPACO_Y = 48;

interface NoLayout { id: string; tipo: FlowNodeTipo }
interface ArestaLayout { from: string; to: string; saida?: string | null }

/** Altura aproximada do cartão quando ainda não foi desenhado. */
export function alturaEstimada(tipo: FlowNodeTipo): number {
  const saidas = FLOW_NODE_TYPES[tipo]?.saidas?.length ?? 0;
  return saidas ? 130 + saidas * 26 : 100;
}

export function posicoesEmArvore(
  nodes: NoLayout[],
  edges: ArestaLayout[],
  altura: (id: string) => number,
): Map<string, { x: number; y: number }> {
  const porId = new Map(nodes.map((n) => [n.id, n]));
  const pos = new Map<string, { x: number; y: number }>();

  // Filhos na ordem das saídas: principal primeiro, depois as extras.
  const filhos = (id: string): string[] => {
    const tipo = porId.get(id)?.tipo;
    const ordem = ["", ...((tipo && FLOW_NODE_TYPES[tipo].saidas) ?? []).map((x) => x.id)];
    return edges
      .filter((e) => e.from === id && porId.has(e.to))
      .sort((a, b) => ordem.indexOf(a.saida ?? "") - ordem.indexOf(b.saida ?? ""))
      .map((e) => e.to);
  };
  // Posiciona a subárvore a partir de `y` e devolve a altura que ela ocupa.
  const posicionar = (id: string, coluna: number, y: number): number => {
    if (pos.has(id)) return 0;
    pos.set(id, { x: coluna * PASSO_X, y });
    let usada = 0;
    for (const filho of filhos(id)) usada += posicionar(filho, coluna + 1, y + usada);
    return Math.max(altura(id) + ESPACO_Y, usada);
  };

  const gatilho = nodes.find((n) => FLOW_NODE_TYPES[n.tipo]?.categoria === "gatilho");
  let y = gatilho ? posicionar(gatilho.id, 0, 0) : 0;
  for (const n of nodes) if (!pos.has(n.id)) y += posicionar(n.id, 0, y);
  return pos;
}
