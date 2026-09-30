"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useNodesState, useEdgesState,
  addEdge, useReactFlow, type Node, type Edge, type Connection, type NodeTypes, type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle, ChevronDown, LayoutGrid, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FLOW_NODE_TYPES, type VariavelEntrada } from "@/lib/flow/node-types";
import { pendenciasDoFluxo, problemaDoNo, resumoDoNo } from "@/lib/flow/resumo";
import type { FlowNode, FlowEdge, FlowNodeTipo, Json } from "@/lib/database.types";
import { FlowNodeCard, type ExecucaoDoNo, type FlowNodeCardData } from "./flow-node-card";
import { FlowNodePalette, FLOW_DRAG_DATA_FORMAT } from "./flow-node-palette";
import { FlowNodeConfigPanel } from "./flow-node-config-panel";

const nodeTypes: NodeTypes = { flowNode: FlowNodeCard };
const PASSO_X = 300;
const LARGURA_NO = 240;

// O canvas segue o tema do app (atributo data-theme em <html>, ou a
// preferência do sistema antes da 1ª escolha) — antes era fixo no escuro.
function assinarTema(aoMudar: () => void) {
  const obs = new MutationObserver(aoMudar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", aoMudar);
  return () => {
    obs.disconnect();
    mq.removeEventListener("change", aoMudar);
  };
}
function temaAtual(): "light" | "dark" {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const ehGatilho = (tipo: FlowNodeTipo) => FLOW_NODE_TYPES[tipo].categoria === "gatilho";

function dadosDoNo(tipo: FlowNodeTipo, config: unknown, execucao: ExecucaoDoNo | null): FlowNodeCardData {
  return { tipo, resumo: resumoDoNo(tipo, config), problema: problemaDoNo(tipo, config), execucao };
}

function paraReactFlowNode(n: FlowNode): Node {
  return {
    id: n.id,
    type: "flowNode",
    position: n.posicao,
    // Gatilho não some com Backspace/Delete por engano — só pelo botão do painel.
    deletable: !ehGatilho(n.tipo),
    data: dadosDoNo(n.tipo, n.config, null),
  };
}

function paraReactFlowEdge(e: FlowEdge): Edge {
  return { id: e.id, source: e.from, target: e.to, animated: true };
}

const tipoDe = (n: Node) => (n.data as unknown as FlowNodeCardData).tipo;

interface Props {
  nodesIniciais: FlowNode[];
  edgesIniciais: FlowEdge[];
  onMudou: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  execucaoPorNo?: Record<string, ExecucaoDoNo>;
}

function FlowCanvasInner({ nodesIniciais, edgesIniciais, onMudou, execucaoPorNo }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(nodesIniciais.map(paraReactFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(edgesIniciais.map(paraReactFlowEdge));
  const [configsPorId, setConfigsPorId] = useState<Record<string, unknown>>(
    Object.fromEntries(nodesIniciais.map((n) => [n.id, n.config])),
  );
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const [pendenciasAbertas, setPendenciasAbertas] = useState(false);
  const { screenToFlowPosition, setCenter, getZoom, fitView } = useReactFlow();
  const tema = useSyncExternalStore(assinarTema, temaAtual, () => "dark" as const);

  // Única fonte de propagação pro pai (FlowBuilder).
  useEffect(() => {
    const flowNodes: FlowNode[] = nodes.map((n) => ({
      id: n.id,
      tipo: tipoDe(n),
      config: (configsPorId[n.id] ?? {}) as Json,
      posicao: { x: n.position.x, y: n.position.y },
    }));
    const flowEdges: FlowEdge[] = edges.map((e) => ({ id: e.id, from: e.source, to: e.target }));
    onMudou(flowNodes, flowEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, configsPorId]);

  // Status da última execução aparece em cada cartão.
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const execucao = execucaoPorNo?.[n.id] ?? null;
        const atual = (n.data as unknown as FlowNodeCardData).execucao ?? null;
        return atual === execucao ? n : { ...n, data: { ...(n.data as unknown as FlowNodeCardData), execucao } };
      }),
    );
  }, [execucaoPorNo, setNodes]);

  const focarNo = useCallback(
    (id: string, posicao?: { x: number; y: number }) => {
      const alvo = posicao ?? nodes.find((n) => n.id === id)?.position;
      setSelecionadoId(id);
      if (alvo) void setCenter(alvo.x + LARGURA_NO / 2, alvo.y + 50, { zoom: Math.max(getZoom(), 0.8), duration: 300 });
    },
    [nodes, setCenter, getZoom],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // v1: grafo linear — no máximo 1 conexão de saída por nó.
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds.filter((e) => e.source !== connection.source)));
    },
    [setEdges],
  );

  function criarNo(tipo: FlowNodeTipo, posicao: { x: number; y: number }): string {
    const id = crypto.randomUUID();
    setConfigsPorId((prev) => ({ ...prev, [id]: {} }));
    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      { id, type: "flowNode", position: posicao, deletable: !ehGatilho(tipo), selected: true, data: dadosDoNo(tipo, {}, null) },
    ]);
    return id;
  }

  /** Nó ao qual o próximo módulo se liga: o selecionado, ou o fim do caminho que sai do gatilho. */
  function ancora(): Node | null {
    if (selecionadoId) {
      const sel = nodes.find((n) => n.id === selecionadoId);
      if (sel) return sel;
    }
    const gatilho = nodes.find((n) => ehGatilho(tipoDe(n)));
    if (!gatilho) return nodes[nodes.length - 1] ?? null;
    const proximo = new Map(edges.map((e) => [e.source, e.target]));
    let atual = gatilho;
    const vistos = new Set([gatilho.id]);
    for (let alvo = proximo.get(atual.id); alvo && !vistos.has(alvo); alvo = proximo.get(alvo)) {
      const n = nodes.find((x) => x.id === alvo);
      if (!n) break;
      vistos.add(alvo);
      atual = n;
    }
    return atual;
  }

  function adicionarPorClique(tipo: FlowNodeTipo) {
    setPaletaAberta(false);
    if (ehGatilho(tipo)) {
      // Gatilho sempre abre o caminho: entra à esquerda de tudo.
      const minX = nodes.length ? Math.min(...nodes.map((n) => n.position.x)) : 60;
      const primeiro = nodes.find((n) => !edges.some((e) => e.target === n.id));
      const posicao = { x: minX - PASSO_X, y: primeiro?.position.y ?? 160 };
      const id = criarNo(tipo, posicao);
      if (primeiro) setEdges((eds) => [...eds, { id: crypto.randomUUID(), source: id, target: primeiro.id, animated: true }]);
      focarNo(id, posicao);
      return;
    }
    const origem = ancora();
    if (!origem) {
      const posicao = { x: 60, y: 160 };
      focarNo(criarNo(tipo, posicao), posicao);
      return;
    }
    const saidaAtual = edges.find((e) => e.source === origem.id);
    // Inserindo no meio do caminho: desce um pouco pra não cobrir o próximo.
    const posicao = { x: origem.position.x + PASSO_X, y: origem.position.y + (saidaAtual ? 140 : 0) };
    const id = criarNo(tipo, posicao);
    setEdges((eds) => {
      const semSaida = eds.filter((e) => e.source !== origem.id);
      const novas: Edge[] = [{ id: crypto.randomUUID(), source: origem.id, target: id, animated: true }];
      if (saidaAtual) novas.push({ id: crypto.randomUUID(), source: id, target: saidaAtual.target, animated: true });
      return [...semSaida, ...novas];
    });
    focarNo(id, posicao);
  }

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const tipo = event.dataTransfer.getData(FLOW_DRAG_DATA_FORMAT) as FlowNodeTipo;
      if (!tipo || !(tipo in FLOW_NODE_TYPES)) return;
      const posicao = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = criarNo(tipo, { x: posicao.x - LARGURA_NO / 2, y: posicao.y - 30 });
      setSelecionadoId(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screenToFlowPosition],
  );

  function atualizarConfig(nodeId: string, config: Record<string, unknown>) {
    setConfigsPorId((prev) => ({ ...prev, [nodeId]: config }));
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
        const dados = n.data as unknown as FlowNodeCardData;
        return { ...n, data: { ...dados, resumo: resumoDoNo(dados.tipo, config), problema: problemaDoNo(dados.tipo, config) } };
      }),
    );
  }

  /** Remove nós religando quem vinha antes com quem vinha depois — o caminho não quebra. */
  const removerNos = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const remover = new Set(ids);
      setSelecionadoId((sel) => (sel && remover.has(sel) ? null : sel));
      setNodes((nds) => nds.filter((n) => !remover.has(n.id)));
      setConfigsPorId((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !remover.has(id))));
      setEdges((eds) => {
        let resultado = eds;
        for (const id of ids) {
          const entradas = resultado.filter((e) => e.target === id);
          const saida = resultado.find((e) => e.source === id);
          resultado = resultado.filter((e) => e.source !== id && e.target !== id);
          if (saida && !remover.has(saida.target)) {
            for (const entrada of entradas) {
              if (remover.has(entrada.source)) continue;
              resultado = [...resultado, { id: crypto.randomUUID(), source: entrada.source, target: saida.target, animated: true }];
            }
          }
        }
        return resultado;
      });
    },
    [setNodes, setEdges],
  );

  // Delete/Backspace: removemos nós do nosso jeito (religando o caminho) e
  // deixamos o React Flow cuidar só de conexões soltas selecionadas.
  const onBeforeDelete = useCallback(
    async ({ nodes: ns, edges: es }: { nodes: Node[]; edges: Edge[] }) => {
      if (!ns.length) return { nodes: [], edges: es };
      removerNos(ns.map((n) => n.id));
      return false;
    },
    [removerNos],
  );

  function organizar() {
    const gatilho = nodes.find((n) => ehGatilho(tipoDe(n)));
    const proximo = new Map(edges.map((e) => [e.source, e.target]));
    const caminho: string[] = [];
    for (let atual = gatilho?.id; atual && !caminho.includes(atual); atual = proximo.get(atual)) caminho.push(atual);
    const soltos = nodes.filter((n) => !caminho.includes(n.id)).map((n) => n.id);
    const pos = new Map<string, { x: number; y: number }>();
    caminho.forEach((id, i) => pos.set(id, { x: i * PASSO_X, y: 0 }));
    soltos.forEach((id, i) => pos.set(id, { x: i * PASSO_X, y: 220 }));
    setNodes((nds) => nds.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })));
    requestAnimationFrame(() => void fitView({ padding: 0.2, duration: 300 }));
  }

  const noSelecionado: FlowNode | null = useMemo(() => {
    if (!selecionadoId) return null;
    const n = nodes.find((x) => x.id === selecionadoId);
    if (!n) return null;
    return { id: n.id, tipo: tipoDe(n), config: (configsPorId[n.id] ?? {}) as Json, posicao: { x: n.position.x, y: n.position.y } };
  }, [selecionadoId, nodes, configsPorId]);

  const variaveisFlow: VariavelEntrada[] = useMemo(() => {
    const gatilho = nodes.find((n) => tipoDe(n) === "gatilho_manual");
    if (!gatilho) return [];
    const config = configsPorId[gatilho.id] as { variaveis?: VariavelEntrada[] } | undefined;
    return Array.isArray(config?.variaveis) ? config.variaveis : [];
  }, [nodes, configsPorId]);

  const pendencias = useMemo(
    () => pendenciasDoFluxo(nodes.map((n) => ({ id: n.id, tipo: tipoDe(n), config: configsPorId[n.id] ?? {} })), edges.map((e) => ({ from: e.source, to: e.target }))),
    [nodes, edges, configsPorId],
  );
  const temGatilho = nodes.some((n) => ehGatilho(tipoDe(n)));
  const soGatilho = nodes.length === 1 && temGatilho;

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden rounded-2xl border border-border bg-background">
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-20 w-64 shrink-0 border-r border-border bg-card shadow-[var(--elevation-lg)] lg:static lg:z-auto lg:flex lg:bg-card/40 lg:shadow-none",
          paletaAberta ? "flex" : "hidden",
        )}
        aria-label="Módulos"
      >
        <div className="flex w-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 lg:hidden">
            <span className="text-sm font-semibold text-foreground">Adicionar módulo</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPaletaAberta(false)} aria-label="Fechar"><X className="h-4 w-4" /></Button>
          </div>
          <div className="min-h-0 flex-1">
            <FlowNodePalette onAdicionar={adicionarPorClique} temGatilho={temGatilho} />
          </div>
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onBeforeDelete={onBeforeDelete}
          onNodeClick={(_e, n) => setSelecionadoId(n.id)}
          onPaneClick={() => { setSelecionadoId(null); setPendenciasAbertas(false); }}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          colorMode={tema}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable className="!hidden !bg-card md:!block" />
        </ReactFlow>

        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto flex gap-2">
            <Button size="sm" className="lg:hidden" onClick={() => setPaletaAberta(true)}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
            <Button size="sm" variant="outline" className="bg-card" onClick={organizar} title="Alinha o caminho da esquerda pra direita">
              <LayoutGrid className="h-3.5 w-3.5" /> Organizar
            </Button>
          </div>
          {pendencias.length > 0 && (
            <div className="pointer-events-auto flex max-w-[min(360px,100%)] flex-col items-end gap-2">
              <Button size="sm" variant="outline" className="border-amber/50 bg-card text-amber hover:bg-amber-soft" onClick={() => setPendenciasAbertas((v) => !v)} aria-expanded={pendenciasAbertas}>
                <AlertTriangle className="h-3.5 w-3.5" /> {pendencias.length} pendência{pendencias.length > 1 ? "s" : ""}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", pendenciasAbertas && "rotate-180")} />
              </Button>
              {pendenciasAbertas && (
                <ul className="flex w-full flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-[var(--elevation-lg)]">
                  {pendencias.map((p, i) => (
                    <li key={`${p.nodeId}-${i}`}>
                      <button
                        type="button"
                        disabled={!p.nodeId}
                        onClick={() => { if (p.nodeId) { focarNo(p.nodeId); setPendenciasAbertas(false); } }}
                        className="flex w-full cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-foreground hover:bg-secondary disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" /> {p.mensagem}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {soGatilho && (
          <div className="pointer-events-none absolute inset-x-3 bottom-4 z-10 flex justify-center">
            <p className="rounded-full border border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground shadow-[var(--elevation-md)]">
              Configure o gatilho e clique num módulo {""}
              <span className="hidden lg:inline">à esquerda</span><span className="lg:hidden">em “Adicionar”</span> — ele entra já conectado.
            </p>
          </div>
        )}
      </div>

      {noSelecionado && (
        <div className="absolute inset-y-0 right-0 z-20 w-full overflow-y-auto border-l border-border bg-card shadow-[var(--elevation-lg)] sm:w-96 lg:static lg:z-auto lg:shrink-0 lg:bg-card/40 lg:shadow-none">
          <FlowNodeConfigPanel
            node={noSelecionado}
            variaveisFlow={variaveisFlow}
            onChange={(config) => atualizarConfig(noSelecionado.id, config)}
            onClose={() => setSelecionadoId(null)}
            onDelete={() => removerNos([noSelecionado.id])}
          />
        </div>
      )}
    </div>
  );
}

export function FlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
