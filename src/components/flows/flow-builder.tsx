"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Play, Pause, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FlowCanvas } from "./flow-canvas";
import { FlowRunHistory } from "./flow-run-history";
import type { VariavelEntrada } from "@/lib/flow/node-types";
import type { AutomationFlowRow, FlowNode, FlowEdge } from "@/lib/database.types";

function novoGatilho(): FlowNode {
  return { id: crypto.randomUUID(), tipo: "gatilho_manual", config: {}, posicao: { x: 60, y: 160 } };
}

export function FlowBuilder({ flowInicial }: { flowInicial: AutomationFlowRow | null }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(flowInicial?.id ?? null);
  const [nome, setNome] = useState(flowInicial?.nome ?? "Novo fluxo");
  const [ativo, setAtivo] = useState(flowInicial?.ativo ?? true);
  const [grafo, setGrafo] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] }>({
    nodes: flowInicial?.nodes?.length ? flowInicial.nodes : [novoGatilho()],
    edges: flowInicial?.edges ?? [],
  });
  const [salvando, setSalvando] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formVariaveis, setFormVariaveis] = useState<Record<string, string> | null>(null);

  const gatilhoManual = grafo.nodes.find((n) => n.tipo === "gatilho_manual");
  const variaveisDeclaradas = Array.isArray((gatilhoManual?.config as { variaveis?: unknown })?.variaveis)
    ? ((gatilhoManual!.config as { variaveis: VariavelEntrada[] }).variaveis)
    : [];

  async function salvar() {
    setSalvando(true);
    setFeedback(null);
    try {
      const payload = { nome, ativo, nodes: grafo.nodes, edges: grafo.edges };
      if (id) {
        const resp = await fetch(`/api/flows/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const data = await resp.json().catch(() => ({}));
        setFeedback(resp.ok ? { ok: true, msg: "Fluxo salvo." } : { ok: false, msg: data.error || "Falha ao salvar o fluxo." });
      } else {
        const resp = await fetch("/api/flows", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) { setFeedback({ ok: false, msg: data.error || "Falha ao criar o fluxo." }); return; }
        setId(data.id);
        setFeedback({ ok: true, msg: "Fluxo criado." });
        router.replace(`/automacoes/fluxos/${data.id}`);
      }
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo() {
    const novo = !ativo;
    setAtivo(novo);
    if (id) await fetch(`/api/flows/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: novo }) });
  }

  function abrirExecucao() {
    if (!id) { setFeedback({ ok: false, msg: "Salve o fluxo antes de executar." }); return; }
    if (variaveisDeclaradas.length) {
      const iniciais: Record<string, string> = {};
      for (const v of variaveisDeclaradas) iniciais[v.chave] = v.padrao;
      setFormVariaveis(iniciais);
      return;
    }
    executarAgora({});
  }

  async function executarAgora(variaveis: Record<string, string>) {
    if (!id) return;
    setExecutando(true);
    setFeedback(null);
    setFormVariaveis(null);
    const resp = await fetch(`/api/flows/${id}/run-now`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variaveis }),
    });
    const data = await resp.json().catch(() => ({}));
    setExecutando(false);
    setFeedback(resp.ok ? { ok: true, msg: "Execução disparada — acompanhe no histórico abaixo." } : { ok: false, msg: data.error || "Falha ao executar." });
    setRefreshKey((k) => k + 1);
  }

  async function remover() {
    if (!id) return;
    if (!confirm(`Remover o fluxo "${nome}"? Essa ação não pode ser desfeita.`)) return;
    await fetch(`/api/flows/${id}`, { method: "DELETE" });
    router.push("/automacoes");
  }

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[560px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} className="max-w-xs font-semibold" />
        <Button variant="secondary" size="sm" onClick={alternarAtivo}>
          {ativo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {ativo ? "Pausar" : "Ativar"}
        </Button>
        <Button size="sm" onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar
        </Button>
        <Button variant="outline" size="sm" onClick={abrirExecucao} disabled={executando || !id}>
          {executando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Executar agora
        </Button>
        {id && (
          <Button variant="ghost" size="sm" onClick={remover} className="ml-auto text-destructive hover:bg-destructive-soft">
            <Trash2 className="h-3.5 w-3.5" /> Remover fluxo
          </Button>
        )}
      </div>

      {formVariaveis && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Valores desta execução</p>
            <Button variant="ghost" size="icon" onClick={() => setFormVariaveis(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {variaveisDeclaradas.map((v) => (
              <div key={v.chave} className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{v.label || v.chave}</Label>
                <Input
                  value={formVariaveis[v.chave] ?? ""}
                  onChange={(e) => setFormVariaveis({ ...formVariaveis, [v.chave]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <Button size="sm" className="self-start" onClick={() => executarAgora(formVariaveis)} disabled={executando}>
            {executando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Executar com esses valores
          </Button>
        </div>
      )}

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "destructive"}>
          <AlertDescription>{feedback.msg}</AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1">
        <FlowCanvas
          nodesIniciais={grafo.nodes}
          edgesIniciais={grafo.edges}
          onMudou={(nodes, edges) => setGrafo({ nodes, edges })}
        />
      </div>

      {id && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">Histórico de execuções</p>
          <FlowRunHistory flowId={id} refreshKey={refreshKey} />
        </div>
      )}
    </div>
  );
}
