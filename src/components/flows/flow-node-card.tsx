"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FLOW_NODE_TYPES } from "@/lib/flow/node-types";
import type { FlowNodeTipo } from "@/lib/database.types";
import { FLOW_NODE_ICONS, FLOW_CATEGORIA_CORES } from "./node-visuals";

export interface FlowNodeCardData {
  tipo: FlowNodeTipo;
  configuradoOk: boolean;
  [chave: string]: unknown;
}

function FlowNodeCardImpl({ data, selected }: NodeProps) {
  const { tipo, configuradoOk } = data as unknown as FlowNodeCardData;
  const meta = FLOW_NODE_TYPES[tipo];
  const Icon = FLOW_NODE_ICONS[meta.icon];
  const cores = FLOW_CATEGORIA_CORES[meta.categoria];
  const ehGatilho = meta.categoria === "gatilho";

  return (
    <div
      className={cn(
        "flex w-56 flex-col gap-1 rounded-xl border bg-card px-3.5 py-3 shadow-md transition-shadow",
        cores.border,
        selected && "ring-2 ring-primary/50",
        !meta.disponivel && "opacity-60",
      )}
    >
      {!ehGatilho && <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-border-strong !bg-muted-2" />}

      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", cores.bg, cores.text)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate text-sm font-semibold text-foreground">{meta.label}</span>
        {!configuradoOk && <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-400" />}
      </div>
      <span className="text-xs text-muted-foreground">{meta.disponivel ? meta.descricao : "Em breve — ainda não executa."}</span>

      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-border-strong !bg-muted-2" />
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardImpl);
