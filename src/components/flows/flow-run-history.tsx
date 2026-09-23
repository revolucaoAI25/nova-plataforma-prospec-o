"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Collapsible } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FLOW_NODE_TYPES } from "@/lib/flow/node-types";
import type { FlowRunRow, FlowRunStepRow, FlowNodeTipo } from "@/lib/database.types";

const STATUS_LABEL: Record<FlowRunRow["status"], string> = {
  executando: "Em execução",
  aguardando_subprocesso: "Aguardando",
  concluido: "Concluído",
  erro: "Erro",
};

function StatusIcon({ status }: { status: FlowRunRow["status"] | FlowRunStepRow["status"] }) {
  if (status === "concluido") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "erro") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "pendente") return <Clock className="h-4 w-4 text-muted-foreground" />;
  return <Loader2 className="h-4 w-4 animate-spin text-amber-400" />;
}

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function FlowRunHistory({ flowId, refreshKey }: { flowId: string; refreshKey?: number }) {
  const [runs, setRuns] = useState<FlowRunRow[]>([]);
  const [steps, setSteps] = useState<FlowRunStepRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    fetch(`/api/flows/${flowId}/runs`)
      .then((r) => r.json())
      .then((d) => {
        if (!ativo) return;
        setRuns(d.runs || []);
        setSteps(d.steps || []);
      })
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [flowId, refreshKey]);

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
              <div className="flex items-center gap-2 text-sm">
                <StatusIcon status={run.status} />
                <span className="font-medium text-foreground">{STATUS_LABEL[run.status]}</span>
                <span className="text-xs text-muted-foreground">{formatarData(run.iniciado_em)}</span>
                {run.erro && <Badge variant="destructive" className="ml-1">erro</Badge>}
              </div>
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
