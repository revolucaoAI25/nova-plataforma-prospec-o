"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FLOW_NODE_TYPES, type SaidaDoNo } from "@/lib/flow/node-types";
import type { FlowNodeTipo, FlowRunStepRow } from "@/lib/database.types";
import { FLOW_NODE_ICONS, FLOW_CATEGORIA_CORES } from "./node-visuals";

export interface ExecucaoDoNo {
  status: FlowRunStepRow["status"];
  leadsSaida: number | null;
  erro: string | null;
  /** Leads que saíram na hora por cada saída extra (ex.: { nao_atende: 12 }). */
  ramos?: Record<string, number>;
  /** Algo que não travou o passo mas merece atenção (ex.: campanha pausada). */
  aviso?: string;
}

const TOM_SAIDA: Record<SaidaDoNo["tom"], { texto: string; handle: string }> = {
  sucesso: { texto: "text-success", handle: "!bg-success" },
  erro: { texto: "text-destructive", handle: "!bg-destructive" },
  info: { texto: "text-info", handle: "!bg-info" },
  neutro: { texto: "text-muted-foreground", handle: "!bg-muted-2" },
};

/** Saídas do nó listadas no rodapé do cartão, cada uma com a sua bolinha de conexão. */
function SaidasDoCartao({ rotuloPrincipal, saidas, ramos }: { rotuloPrincipal: string; saidas: SaidaDoNo[]; ramos?: Record<string, number> }) {
  const linhas = [{ id: null as string | null, label: rotuloPrincipal, tom: "sucesso" as const, quando: "imediata" as const }, ...saidas];
  const temResultado = saidas.some((s) => s.quando === "resultado");
  return (
    <div className="-mx-3.5 mt-1 flex flex-col border-t border-border/70 pt-1.5">
      {linhas.map((s, i) => {
        const tom = s.id === null ? { texto: "text-foreground", handle: "!bg-primary" } : TOM_SAIDA[s.tom];
        const qtd = s.id ? ramos?.[s.id] : undefined;
        return (
          <div key={s.id ?? "principal"}>
            {temResultado && i === 1 && (
              <p className="px-3.5 pb-0.5 pt-1 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-2">Conforme o resultado</p>
            )}
            <div className="relative flex h-6 items-center justify-end gap-1.5 pr-3.5 text-[11px]">
              {qtd !== undefined && <span className="rounded-full bg-secondary px-1.5 font-medium text-muted-foreground">{qtd}</span>}
              <span className={cn("font-medium", tom.texto)}>{s.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={s.id ?? undefined}
                className={cn("!h-3 !w-3 !border-2 !border-card", tom.handle)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
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
      <>
        <span className="flex items-center gap-1 text-[11px] font-medium text-success">
          <CheckCircle2 className="h-3 w-3" /> {execucao.leadsSaida !== null ? `${execucao.leadsSaida} lead${execucao.leadsSaida === 1 ? "" : "s"}` : "ok"}
        </span>
        {execucao.aviso && (
          <span className="flex items-start gap-1 text-[11px] font-medium text-amber" title={execucao.aviso}>
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> <span className="line-clamp-2">{execucao.aviso}</span>
          </span>
        )}
      </>
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

      {meta.saidas?.length ? (
        <SaidasDoCartao rotuloPrincipal={meta.rotuloSaidaPrincipal ?? "Em seguida"} saidas={meta.saidas} ramos={execucao?.ramos} />
      ) : (
        <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-card !bg-primary" />
      )}
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardImpl);
