"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FLOW_NODE_TYPES } from "@/lib/flow/node-types";
import type { FlowNodeTipo, FlowRunStepRow } from "@/lib/database.types";
import { FLOW_NODE_ICONS, FLOW_CATEGORIA_CORES } from "./node-visuals";

export interface ExecucaoDoNo {
  status: FlowRunStepRow["status"];
  leadsSaida: number | null;
  erro: string | null;
}

export interface FlowNodeCardData {
  tipo: FlowNodeTipo;
  resumo: string | null;
  problema: string | null;
  execucao?: ExecucaoDoNo | null;
  [chave: string]: unknown;
}

function SeloExecucao({ execucao }: { execucao: ExecucaoDoNo }) {
  if (execucao.status === "concluido") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-success">
        <CheckCircle2 className="h-3 w-3" /> {execucao.leadsSaida !== null ? `${execucao.leadsSaida} lead${execucao.leadsSaida === 1 ? "" : "s"}` : "ok"}
      </span>
    );
  }
  if (execucao.status === "erro") {
    return (
      <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-destructive" title={execucao.erro ?? undefined}>
        <XCircle className="h-3 w-3 shrink-0" /> <span className="truncate">{execucao.erro ?? "erro"}</span>
      </span>
    );
  }
  if (execucao.status === "pendente") return null;
  if (execucao.status === "pulado") {
    return <span className="text-[11px] font-medium text-muted-foreground">Pulado: nenhum lead novo</span>;
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-amber">
      <Loader2 className="h-3 w-3 animate-spin" /> rodando
    </span>
  );
}

function FlowNodeCardImpl({ data, selected }: NodeProps) {
  const { tipo, resumo, problema, execucao } = data as unknown as FlowNodeCardData;
  const meta = FLOW_NODE_TYPES[tipo];
  const Icon = FLOW_NODE_ICONS[meta.icon];
  const cores = FLOW_CATEGORIA_CORES[meta.categoria];
  const ehGatilho = meta.categoria === "gatilho";

  return (
    <div
      className={cn(
        "flex w-60 flex-col gap-1.5 rounded-xl border bg-card px-3.5 py-3 shadow-[var(--elevation-sm)] transition-shadow",
        problema ? "border-amber/60" : cores.border,
        selected && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
        !meta.disponivel && "opacity-60",
      )}
    >
      {!ehGatilho && <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-card !bg-muted-2" />}

      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", cores.bg, cores.text)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", cores.text)}>{ehGatilho ? "Gatilho" : meta.categoria === "controle" ? "Controle" : meta.categoria}</span>
          <span className="truncate text-sm font-semibold leading-tight text-foreground">{meta.label}</span>
        </div>
        {problema && <AlertTriangle className="ml-auto h-4 w-4 shrink-0 text-amber" aria-label="Configuração pendente" />}
      </div>

      {problema ? (
        <span className="text-xs text-amber">{problema}</span>
      ) : (
        <span className="line-clamp-2 text-xs text-muted-foreground">{meta.disponivel ? (resumo ?? meta.descricao) : "Em breve — ainda não executa."}</span>
      )}
      {execucao && <SeloExecucao execucao={execucao} />}

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-card !bg-primary" />
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardImpl);
