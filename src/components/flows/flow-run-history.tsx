"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock, RotateCw } from "lucide-react";
import { Collapsible } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FLOW_NODE_TYPES } from "@/lib/flow/node-types";
import type { FlowRunRow, FlowRunStepRow, FlowNodeTipo } from "@/lib/database.types";

const STATUS_LABEL: Record<FlowRunRow["status"], string> = {
  executando: "Em execução",
  aguardando_subprocesso: "Aguardando",
  aguardando_retry: "Tentando de novo",
  concluido: "Concluído",
  erro: "Erro",
};

function StatusIcon({ status }: { status: FlowRunRow["status"] | FlowRunStepRow["status"] }) {
  if (status === "concluido") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "erro") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "pendente") return <Clock className="h-4 w-4 text-muted-foreground" />;
  if (status === "aguardando_retry") return <RotateCw className="h-4 w-4 text-amber-400" />;
  return <Loader2 className="h-4 w-4 animate-spin text-amber-400" />;
}

function formatarProximaTentativa(iso: string | null) {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "a qualquer instante";
  const min = Math.ceil(diffMs / 60_000);
  return min <= 1 ? "em ~1 min" : `em ~${min} min`;
}

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const EM_ANDAMENTO = new Set<FlowRunRow["status"]>(["executando", "aguardando_subprocesso", "aguardando_retry"]);

export function FlowRunHistory({
  flowId,
  refreshKey,
  onCarregado,
}: {
  flowId: string;
  refreshKey?: number;
  onCarregado?: (runs: FlowRunRow[], steps: FlowRunStepRow[]) => void;
}) {
  const [runs, setRuns] = useState<FlowRunRow[]>([]);
  const [steps, setSteps] = useState<FlowRunStepRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [reexecutando, setReexecutando] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const resp = await fetch(`/api/flows/${flowId}/runs`, { cache: "no-store" }).catch(() => null);
    if (!resp?.ok) return;
    const d = await resp.json();
    setRuns(d.runs || []);
    setSteps(d.steps || []);
    onCarregado?.(d.runs || [], d.steps || []);
  }, [flowId, onCarregado]);

  // Enquanto houver execução em andamento, atualiza sozinho (o motor avança
  // um nó por tick do worker) — antes precisava recarregar a página.
  const emAndamento = runs.some((r) => EM_ANDAMENTO.has(r.status));
  useEffect(() => {
    if (!emAndamento) return;
    const t = setInterval(() => void recarregar(), 5000);
    return () => clearInterval(t);
  }, [emAndamento, recarregar]);

  // recarregar() é assíncrono (await fetch) — o set-state real só roda
  // depois do 1º await, não durante a render deste efeito.
  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar().finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [recarregar, refreshKey]);

  async function tentarNovamente(runId: string) {
    setReexecutando(runId);
    await fetch(`/api/flows/${flowId}/runs/${runId}/retry`, { method: "POST" });
    await recarregar();
    setReexecutando(null);
  }

  if (carregando) return <p className="text-sm text-muted-foreground">Carregando histórico…</p>;
  if (!runs.length) {
    return <EmptyState icon={Clock} title="Nenhuma execução ainda" description="Execuções do fluxo (manuais ou automáticas) aparecem aqui." />;
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-secondary/20">
      {runs.map((run) => {
        const stepsDaRun = steps.filter((s) => s.run_id === run.id);
        return (
          <Collapsible
            key={run.id}
            className="p-3.5"
            trigger={
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StatusIcon status={run.status} />
                <span className="font-medium text-foreground">{STATUS_LABEL[run.status]}</span>
                <span className="text-xs text-muted-foreground">{formatarData(run.iniciado_em)}</span>
                {run.status === "aguardando_retry" && (
                  <Badge variant="outline" className="ml-1">
                    tentativa {run.tentativas}/{run.max_tentativas} · próxima {formatarProximaTentativa(run.proxima_tentativa_em)}
                  </Badge>
                )}
                {run.status === "erro" && (
                  <Badge variant="destructive" className="ml-1">erro após {run.tentativas} tentativa(s)</Badge>
                )}
              </div>
            }
            acoes={
              run.status === "erro" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={reexecutando === run.id}
                  onClick={() => tentarNovamente(run.id)}
                >
                  <RotateCw className="h-3 w-3" /> {reexecutando === run.id ? "Reiniciando…" : "Tentar novamente"}
                </Button>
              ) : undefined
            }
          >
            <div className="mt-3 flex flex-col gap-2 pl-6">
              {run.erro && <p className="text-xs text-destructive">{run.erro}</p>}
              {stepsDaRun.map((step) => (
                <div key={step.id} className="flex items-center gap-2 text-xs">
                  <StatusIcon status={step.status} />
                  <span className="text-foreground">{FLOW_NODE_TYPES[step.tipo as FlowNodeTipo]?.label ?? step.tipo}</span>
                  {step.leads_saida !== null && <span className="text-muted-foreground">· {step.leads_saida} lead(s)</span>}
                  {step.erro && <span className="text-destructive">· {step.erro}</span>}
                </div>
              ))}
              {!stepsDaRun.length && <p className="text-xs text-muted-foreground">Sem etapas registradas.</p>}
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
