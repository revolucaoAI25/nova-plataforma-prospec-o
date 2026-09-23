"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useNodesState, useEdgesState,
  addEdge, useReactFlow, type Node, type Edge, type Connection, type NodeTypes, type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FLOW_NODE_TYPES } from "@/lib/flow/node-types";
import type { FlowNode, FlowEdge, FlowNodeTipo, Json } from "@/lib/database.types";
import { FlowNodeCard, type FlowNodeCardData } from "./flow-node-card";
import { FlowNodePalette, FLOW_DRAG_DATA_FORMAT } from "./flow-node-palette";
import { FlowNodeConfigPanel } from "./flow-node-config-panel";

const nodeTypes: NodeTypes = { flowNode: FlowNodeCard };

function configuradoOk(tipo: FlowNodeTipo, config: unknown): boolean {
  return FLOW_NODE_TYPES[tipo].configSchema.safeParse(config).success;
}

function paraReactFlowNode(n: FlowNode): Node {
  return {
    id: n.id,
    type: "flowNode",
    position: n.posicao,
    data: { tipo: n.tipo, configuradoOk: configuradoOk(n.tipo, n.config) } satisfies FlowNodeCardData,
  };
}

function paraReactFlowEdge(e: FlowEdge): Edge {
  return { id: e.id, source: e.from, target: e.to, animated: true };
}

function FlowCanvasInner({
  nodesIniciais,
  edgesIniciais,
  onMudou,
}: {
  nodesIniciais: FlowNode[];
  edgesIniciais: FlowEdge[];
  onMudou: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(nodesIniciais.map(paraReactFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(edgesIniciais.map(paraReactFlowEdge));
  const [configsPorId, setConfigsPorId] = useState<Record<string, unknown>>(
    Object.fromEntries(nodesIniciais.map((n) => [n.id, n.config])),
  );
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Única fonte de propagação pro pai (FlowBuilder) — reage a qualquer
  // mudança de posição/conexão/config, em vez de cada handler precisar
  // chamar onMudou manualmente com o array recém-computado.
  useEffect(() => {
    const flowNodes: FlowNode[] = nodes.map((n) => ({
      id: n.id,
      tipo: (n.data as unknown as FlowNodeCardData).tipo,
      config: (configsPorId[n.id] ?? {}) as Json,
      posicao: { x: n.position.x, y: n.position.y },
    }));
    const flowEdges: FlowEdge[] = edges.map((e) => ({ id: e.id, from: e.source, to: e.target }));
    onMudou(flowNodes, flowEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, configsPorId]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // v1: grafo linear/DAG simples — no máximo 1 conexão de saída por nó.
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds.filter((e) => e.source !== connection.source)));
    },
    [setEdges],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const tipo = event.dataTransfer.getData(FLOW_DRAG_DATA_FORMAT) as FlowNodeTipo;
      if (!tipo || !(tipo in FLOW_NODE_TYPES)) return;
      const posicao = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = crypto.randomUUID();
      setConfigsPorId((prev) => ({ ...prev, [id]: {} }));
      setNodes((nds) => [
        ...nds,
        { id, type: "flowNode", position: posicao, data: { tipo, configuradoOk: configuradoOk(tipo, {}) } satisfies FlowNodeCardData },
      ]);
    },
    [screenToFlowPosition, setNodes],
  );

  function atualizarConfig(nodeId: string, config: Record<string, unknown>) {
    setConfigsPorId((prev) => ({ ...prev, [nodeId]: config }));
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...(n.data as unknown as FlowNodeCardData), configuradoOk: configuradoOk((n.data as unknown as FlowNodeCardData).tipo, config) } }
          : n,
      ),
    );
  }

  function removerNode(nodeId: string) {
    setSelecionadoId(null);
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }

  const noSelecionado: FlowNode | null = useMemo(() => {
    if (!selecionadoId) return null;
    const n = nodes.find((x) => x.id === selecionadoId);
    if (!n) return null;
    return {
      id: n.id, tipo: (n.data as unknown as FlowNodeCardData).tipo,
      config: (configsPorId[n.id] ?? {}) as Json, posicao: { x: n.position.x, y: n.position.y },
    };
  }, [selecionadoId, nodes, configsPorId]);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden rounded-2xl border border-border bg-background">
      <div className="w-56 shrink-0 border-r border-border bg-card/40">
        <FlowNodePalette />
      </div>

      <div className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_e, n) => setSelecionadoId(n.id)}
          onPaneClick={() => setSelecionadoId(null)}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          colorMode="dark"
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-card" />
        </ReactFlow>
      </div>

      {noSelecionado && (
        <div className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card/40 sm:w-80 lg:w-96">
          <FlowNodeConfigPanel
            node={noSelecionado}
            onChange={(config) => atualizarConfig(noSelecionado.id, config)}
            onClose={() => setSelecionadoId(null)}
            onDelete={() => removerNode(noSelecionado.id)}
          />
        </div>
      )}
    </div>
  );
}

export function FlowCanvas(props: {
  nodesIniciais: FlowNode[];
  edgesIniciais: FlowEdge[];
  onMudou: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
