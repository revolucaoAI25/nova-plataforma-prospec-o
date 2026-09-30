"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Play, Pause, Trash2, Loader2, X, Maximize2, Minimize2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-provider";
import { cn } from "@/lib/utils";
import { pendenciasDoFluxo } from "@/lib/flow/resumo";
import { FlowCanvas } from "./flow-canvas";
import { FlowRunHistory } from "./flow-run-history";
import type { ExecucaoDoNo } from "./flow-node-card";
import type { VariavelEntrada } from "@/lib/flow/node-types";
import type { AutomationFlowRow, FlowNode, FlowEdge, FlowRunRow, FlowRunStepRow } from "@/lib/database.types";

function novoGatilho(): FlowNode {
  return { id: crypto.randomUUID(), tipo: "gatilho_manual", config: {}, posicao: { x: 60, y: 160 } };
}

// Comparação de "tem alteração?" independente da ordem das chaves (fluxos
// montados no servidor, como os do onboarding, gravam em outra ordem).
function instantaneo(nome: string, ativo: boolean, nodes: FlowNode[], edges: FlowEdge[]) {
  return JSON.stringify({
    nome,
    ativo,
    nodes: nodes.map((n) => [n.id, n.tipo, n.config, Math.round(n.posicao.x), Math.round(n.posicao.y)]),
    edges: edges.map((e) => [e.id, e.from, e.to]),
  });
}

export function FlowBuilder({ flowInicial }: { flowInicial: AutomationFlowRow | null }) {
  const router = useRouter();
  const confirmar = useConfirm();
  const [id, setId] = useState<string | null>(flowInicial?.id ?? null);
  const [nome, setNome] = useState(flowInicial?.nome ?? "Novo fluxo");
  // Fluxo novo nasce pausado: só liga quando estiver completo.
  const [ativo, setAtivo] = useState(flowInicial?.ativo ?? false);
  const [grafo, setGrafo] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] }>(() => ({
    nodes: flowInicial?.nodes?.length ? flowInicial.nodes : [novoGatilho()],
    edges: flowInicial?.edges ?? [],
  }));
  const salvoRef = useRef<string | null>(flowInicial ? instantaneo(flowInicial.nome, flowInicial.ativo, flowInicial.nodes, flowInicial.edges) : null);
  const [salvoVersao, setSalvoVersao] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formVariaveis, setFormVariaveis] = useState<Record<string, string> | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [execucaoPorNo, setExecucaoPorNo] = useState<Record<string, ExecucaoDoNo>>({});

  const gatilhoManual = grafo.nodes.find((n) => n.tipo === "gatilho_manual");
  const variaveisDeclaradas = Array.isArray((gatilhoManual?.config as { variaveis?: unknown })?.variaveis)
    ? ((gatilhoManual!.config as { variaveis: VariavelEntrada[] }).variaveis)
    : [];
  const pendencias = useMemo(() => pendenciasDoFluxo(grafo.nodes, grafo.edges), [grafo]);

  const atualSnapshot = instantaneo(nome, ativo, grafo.nodes, grafo.edges);
  // salvoVersao só existe pra re-renderizar depois de salvar (o ref não dispara render).
  const alterado = salvoVersao >= 0 && atualSnapshot !== salvoRef.current;

  // Não perder trabalho: avisa antes de fechar/recarregar com alterações.
  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  // Mensagem de sucesso some sozinha; erro fica até a próxima ação.
  useEffect(() => {
    if (!feedback?.ok) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  // Tela cheia: Esc sai e a página de trás não rola.
  useEffect(() => {
    if (!telaCheia) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) setTelaCheia(false);
    };
    document.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
    };
  }, [telaCheia]);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setFeedback(null);
    // Com pendências, salva como rascunho pausado — o servidor só aceita
    // ativo o que o motor consegue rodar.
    const ativoFinal = pendencias.length ? false : ativo;
    const payload = { nome: nome.trim() || "Fluxo sem nome", ativo: ativoFinal, nodes: grafo.nodes, edges: grafo.edges };
    try {
      const resp = await fetch(id ? `/api/flows/${id}` : "/api/flows", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setFeedback({ ok: false, msg: data.error || "Falha ao salvar o fluxo." });
        return;
      }
      if (ativoFinal !== ativo) setAtivo(ativoFinal);
      salvoRef.current = instantaneo(payload.nome, ativoFinal, grafo.nodes, grafo.edges);
      setSalvoVersao((v) => v + 1);
      setFeedback({
        ok: true,
        msg: pendencias.length
          ? `Salvo como rascunho (pausado). Resolva ${pendencias.length === 1 ? "a pendência" : `as ${pendencias.length} pendências`} pra ativar.`
          : "Fluxo salvo.",
      });
      if (!id) {
        setId(data.id);
        router.replace(`/automacoes/fluxos/${data.id}`);
      }
    } finally {
      setSalvando(false);
    }
  }, [ativo, grafo, id, nome, pendencias.length, router]);

  // Ctrl/Cmd+S salva.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!salvando) void salvar();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [salvar, salvando]);

  async function alternarAtivo() {
    const novo = !ativo;
    if (novo && pendencias.length) {
      setFeedback({ ok: false, msg: `Resolva ${pendencias.length === 1 ? "a pendência" : `as ${pendencias.length} pendências`} antes de ativar (botão amarelo no canto do canvas).` });
      return;
    }
    if (!id || alterado) {
      // Ainda não salvo (ou com mudanças): muda o estado e salva junto.
      setAtivo(novo);
      setFeedback({ ok: true, msg: novo ? "Vai ser ativado ao salvar." : "Vai ser pausado ao salvar." });
      return;
    }
    const resp = await fetch(`/api/flows/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: novo }) });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setFeedback({ ok: false, msg: data.error || "Não foi possível mudar o estado do fluxo." });
      return;
    }
    setAtivo(novo);
    salvoRef.current = instantaneo(nome, novo, grafo.nodes, grafo.edges);
    setSalvoVersao((v) => v + 1);
    setFeedback({ ok: true, msg: novo ? "Fluxo ativado." : "Fluxo pausado." });
  }

  function abrirExecucao() {
    if (!id) { setFeedback({ ok: false, msg: "Salve o fluxo antes de executar." }); return; }
    if (pendencias.length) { setFeedback({ ok: false, msg: "Resolva as pendências antes de executar." }); return; }
    if (alterado) { setFeedback({ ok: false, msg: "Salve as alterações antes de executar — a execução usa a versão salva." }); return; }
    if (variaveisDeclaradas.length) {
      const iniciais: Record<string, string> = {};
      for (const v of variaveisDeclaradas) iniciais[v.chave] = v.padrao;
      setFormVariaveis(iniciais);
      return;
    }
    void executarAgora({});
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
    setFeedback(resp.ok ? { ok: true, msg: "Execução disparada — o andamento aparece em cada módulo e no histórico." } : { ok: false, msg: data.error || "Falha ao executar." });
    setRefreshKey((k) => k + 1);
  }

  async function remover() {
    if (!id) return;
    if (!(await confirmar({ title: `Remover o fluxo "${nome}"?`, description: "Essa ação não pode ser desfeita.", destructive: true }))) return;
    await fetch(`/api/flows/${id}`, { method: "DELETE" });
    salvoRef.current = atualSnapshot;
    router.push("/automacoes");
  }

  // Última execução → status por nó, mostrado nos cartões do canvas.
  const aoCarregarHistorico = useCallback((runs: FlowRunRow[], steps: FlowRunStepRow[]) => {
    const ultima = runs[0];
    if (!ultima) return setExecucaoPorNo({});
    const porNo: Record<string, ExecucaoDoNo> = {};
    for (const s of steps) {
      if (s.run_id === ultima.id) porNo[s.node_id] = { status: s.status, leadsSaida: s.leads_saida, erro: s.erro };
    }
    setExecucaoPorNo(porNo);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          "flex flex-col gap-3",
          telaCheia ? "fixed inset-0 z-50 bg-background p-3 md:p-4" : "h-[calc(100dvh-230px)] min-h-[600px]",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9 w-full font-semibold sm:max-w-xs" aria-label="Nome do fluxo" />
          <Badge variant="outline" className={cn("gap-1.5", ativo ? "border-primary/40 text-primary" : "text-muted-foreground")}>
            <CircleDot className="h-3 w-3" /> {ativo ? "Ativo" : "Pausado"}
          </Badge>
          {alterado && <span className="text-xs text-amber">Alterações não salvas</span>}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={alternarAtivo}>
              {ativo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {ativo ? "Pausar" : "Ativar"}
            </Button>
            <Button variant="outline" size="sm" onClick={abrirExecucao} disabled={executando || !id}>
              {executando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Executar agora
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando} title="Salvar (Ctrl+S)">
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTelaCheia((v) => !v)} aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} title={telaCheia ? "Sair da tela cheia (Esc)" : "Tela cheia"}>
              {telaCheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            {id && !telaCheia && (
              <Button variant="ghost" size="icon" onClick={remover} className="text-destructive hover:bg-destructive-soft" aria-label="Remover fluxo" title="Remover fluxo">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {formVariaveis && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Valores desta execução</p>
              <Button variant="ghost" size="icon" onClick={() => setFormVariaveis(null)} aria-label="Fechar"><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {variaveisDeclaradas.map((v) => (
                <div key={v.chave} className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">{v.label || v.chave}</Label>
                  <Input value={formVariaveis[v.chave] ?? ""} onChange={(e) => setFormVariaveis({ ...formVariaveis, [v.chave]: e.target.value })} />
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
          <Alert variant={feedback.ok ? "success" : "destructive"} role={feedback.ok ? "status" : "alert"}>
            <AlertDescription>{feedback.msg}</AlertDescription>
          </Alert>
        )}

        <div className="min-h-0 flex-1">
          <FlowCanvas
            nodesIniciais={grafo.nodes}
            edgesIniciais={grafo.edges}
            onMudou={(nodes, edges) => setGrafo({ nodes, edges })}
            execucaoPorNo={execucaoPorNo}
          />
        </div>
      </div>

      {id && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">Histórico de execuções</p>
          <FlowRunHistory flowId={id} refreshKey={refreshKey} onCarregado={aoCarregarHistorico} />
        </div>
      )}
    </div>
  );
}
