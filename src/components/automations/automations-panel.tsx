"use client";

import { useState } from "react";
import { Plus, Trash2, Play, Pause, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AutomationRow, DispatchCampaignRow } from "@/lib/database.types";
import { formatarDias, formatarHorarios, formatarProximaExecucao } from "@/lib/automation-logic";
import { AutomationForm } from "@/components/automations/automation-form";

export function AutomationsPanel({
  automacoesIniciais,
  campanhas,
}: {
  automacoesIniciais: AutomationRow[];
  campanhas: DispatchCampaignRow[];
}) {
  const [automacoes, setAutomacoes] = useState(automacoesIniciais);
  const [showForm, setShowForm] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function refetch() {
    const resp = await fetch("/api/automations");
    const data = await resp.json();
    setAutomacoes(data.automacoes || []);
  }

  async function alternarAtiva(a: AutomationRow) {
    await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativa: !a.ativa }),
    });
    setAutomacoes((prev) => prev.map((x) => (x.id === a.id ? { ...x, ativa: !x.ativa } : x)));
  }

  async function remover(id: string) {
    if (!confirm("Remover esta automação?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    setAutomacoes((prev) => prev.filter((a) => a.id !== id));
  }

  async function executarAgora(id: string) {
    setRunningId(id);
    setFeedback(null);
    const resp = await fetch(`/api/automations/${id}/run-now`, { method: "POST" });
    setRunningId(null);
    setFeedback(resp.ok ? { ok: true, msg: "Execução concluída — veja o resultado no Histórico." } : { ok: false, msg: "Falha ao executar a automação." });
    refetch();
  }

  return (
    <div className="flex flex-col gap-6">
      {feedback && (
        <Alert variant={feedback.ok ? "success" : "destructive"}>
          <AlertDescription>{feedback.msg}</AlertDescription>
        </Alert>
      )}

      {automacoes.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhuma automação criada ainda.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {automacoes.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{a.nome}</CardTitle>
                <CardDescription>
                  {a.tipo === "cnpj" ? "Busca CNPJ" : "Busca Google Maps"} · {formatarDias(a.dias_semana)} às {formatarHorarios(a.horario)}
                </CardDescription>
              </div>
              <Badge variant={a.ativa ? "success" : "outline"}>{a.ativa ? "Ativa" : "Pausada"}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">Próxima execução: {formatarProximaExecucao(a.proxima_execucao)}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => alternarAtiva(a)}>
                  {a.ativa ? <><Pause className="h-3.5 w-3.5" /> Pausar</> : <><Play className="h-3.5 w-3.5" /> Ativar</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => executarAgora(a.id)} disabled={runningId === a.id}>
                  <RotateCw className={`h-3.5 w-3.5 ${runningId === a.id ? "animate-spin" : ""}`} /> Executar agora
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remover(a.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm ? (
        <AutomationForm
          campanhas={campanhas}
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Button onClick={() => setShowForm(true)} className="self-start">
          <Plus className="h-4 w-4" /> Nova automação
        </Button>
      )}
    </div>
  );
}
