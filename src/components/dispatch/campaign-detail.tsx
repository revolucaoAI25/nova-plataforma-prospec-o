"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Play, Pause, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { CadenceStepRow, DispatchCampaignRow, WhatsappInstanceRow } from "@/lib/database.types";
import type { SearchRow } from "@/lib/database.types";

export function CampaignDetail({
  campanha,
  etapasIniciais,
  statsIniciais,
  instancias,
  pesquisas,
}: {
  campanha: DispatchCampaignRow;
  etapasIniciais: CadenceStepRow[];
  statsIniciais: Record<string, number>;
  instancias: WhatsappInstanceRow[];
  pesquisas: SearchRow[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(campanha.status);
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [stats, setStats] = useState(statsIniciais);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [atrasoHoras, setAtrasoHoras] = useState(0);
  const [corpoMensagem, setCorpoMensagem] = useState("");
  const [addingStep, setAddingStep] = useState(false);

  const [searchId, setSearchId] = useState("");
  const [manualLista, setManualLista] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const instancia = instancias.find((i) => i.id === campanha.instance_id);

  async function alternarStatus() {
    const novo = status === "ativa" ? "pausada" : "ativa";
    const resp = await fetch(`/api/dispatch/campaigns/${campanha.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    if (resp.ok) setStatus(novo);
  }

  async function adicionarEtapa(e: React.FormEvent) {
    e.preventDefault();
    if (!corpoMensagem.trim()) return;
    setAddingStep(true);
    const resp = await fetch(`/api/dispatch/campaigns/${campanha.id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordem: etapas.length + 1, atrasoHoras, corpoMensagem }),
    });
    setAddingStep(false);
    if (resp.ok) {
      setCorpoMensagem("");
      setAtrasoHoras(0);
      router.refresh();
      const listResp = await fetch(`/api/dispatch/campaigns/${campanha.id}`);
      const data = await listResp.json();
      setEtapas(data.etapas || []);
    }
  }

  async function removerEtapa(stepId: string) {
    await fetch(`/api/dispatch/campaigns/${campanha.id}/steps/${stepId}`, { method: "DELETE" });
    setEtapas((prev) => prev.filter((e) => e.id !== stepId));
  }

  async function inscrever() {
    if (!etapas.length) {
      setFeedback({ ok: false, msg: "Crie ao menos uma etapa de cadência antes de inscrever alvos." });
      return;
    }
    setEnrolling(true);
    setFeedback(null);

    const body: Record<string, unknown> = {};
    if (searchId) {
      body.searchId = searchId;
    } else if (manualLista.trim()) {
      body.leads = manualLista
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [nome, telefone] = l.split(",").map((x) => x.trim());
          return telefone ? { nome, telefone } : { nome: "", telefone: nome };
        });
    } else {
      setFeedback({ ok: false, msg: "Escolha uma pesquisa do histórico ou cole uma lista de nome,telefone." });
      setEnrolling(false);
      return;
    }

    const resp = await fetch(`/api/dispatch/campaigns/${campanha.id}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    setEnrolling(false);
    if (!resp.ok) {
      setFeedback({ ok: false, msg: data.error || "Não foi possível inscrever os alvos." });
      return;
    }
    setFeedback({
      ok: true,
      msg: `${data.inscritos} inscritos · ${data.duplicados} duplicados · ${data.opt_out} em opt-out · ${data.invalidos} inválidos.`,
    });
    setManualLista("");
    setSearchId("");
    const statsResp = await fetch(`/api/dispatch/campaigns/${campanha.id}`);
    const statsData = await statsResp.json();
    setStats(statsData.stats || stats);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Status</CardTitle>
            <CardDescription>Instância: {instancia?.nome ?? "—"}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === "ativa" ? "success" : "outline"}>{status}</Badge>
            <Button size="sm" onClick={alternarStatus} disabled={!etapas.length}>
              {status === "ativa" ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Ativar</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats).map(([k, v]) => (
              <Badge key={k} variant="secondary">{k}: {v}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadência de mensagens</CardTitle>
          <CardDescription>Cada etapa dispara após o atraso configurado desde a etapa anterior (ou desde a inscrição, na 1ª).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {etapas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa criada ainda.</p>}
          {etapas.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Etapa {e.ordem} · {e.atraso_horas}h de atraso</p>
                <p className="whitespace-pre-wrap text-sm">{e.corpo_mensagem}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removerEtapa(e.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <form onSubmit={adicionarEtapa} className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="atraso" className="shrink-0">Atraso (horas)</Label>
              <Input id="atraso" type="number" min={0} step={0.5} value={atrasoHoras} onChange={(e) => setAtrasoHoras(Number(e.target.value))} className="w-28" />
            </div>
            <Textarea
              value={corpoMensagem}
              onChange={(e) => setCorpoMensagem(e.target.value)}
              placeholder="Corpo da mensagem — use {{nome}} para inserir o nome do lead"
              rows={3}
            />
            <Button type="submit" disabled={addingStep} className="self-start">
              <Plus className="h-4 w-4" /> {addingStep ? "Adicionando…" : "Adicionar etapa"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inscrever alvos</CardTitle>
          <CardDescription>De uma pesquisa do histórico, ou colando uma lista (uma linha por lead: nome,telefone).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {feedback && (
            <Alert variant={feedback.ok ? "success" : "destructive"}>
              <AlertDescription>{feedback.msg}</AlertDescription>
            </Alert>
          )}
          <Select value={searchId} onValueChange={setSearchId}>
            <SelectTrigger><SelectValue placeholder="Escolher pesquisa do histórico" /></SelectTrigger>
            <SelectContent>
              {pesquisas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {(p.nicho || p.localidade || "Pesquisa")} — {p.total_results} leads
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-center text-xs text-muted-foreground">ou</span>
          <Textarea
            value={manualLista}
            onChange={(e) => setManualLista(e.target.value)}
            placeholder={"João Silva,5511999999999\nMaria Souza,5511988888888"}
            rows={4}
          />
          <Button onClick={inscrever} disabled={enrolling} className="self-start">
            <UserPlus className="h-4 w-4" /> {enrolling ? "Inscrevendo…" : "Inscrever"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
