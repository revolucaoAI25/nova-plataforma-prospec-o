"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, History as HistoryIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LeadStagingEditor, type LeadStaged } from "@/components/enrichment/lead-staging-editor";
import { EnrichmentOptions, OPCOES_PADRAO, type OpcoesUI } from "@/components/enrichment/enrichment-options";
import { EnrichmentResults } from "@/components/enrichment/enrichment-results";
import type { EnrichmentLeadRow, EnrichmentRunRow } from "@/lib/database.types";

const LIMITE_LOTE = 50;
const POLL_MS = 2500;

export function EnrichmentPanel({ openaiKeyConfigurada }: { openaiKeyConfigurada: boolean }) {
  const [leads, setLeads] = useState<LeadStaged[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesUI>(OPCOES_PADRAO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<EnrichmentRunRow | null>(null);
  const [runLeads, setRunLeads] = useState<EnrichmentLeadRow[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [runsAnteriores, setRunsAnteriores] = useState<EnrichmentRunRow[]>([]);
  const [carregandoRuns, setCarregandoRuns] = useState(false);

  const leadsValidos = leads.filter((l) => l.email.trim() || l.telefone.trim());

  async function carregarRunsAnteriores() {
    setCarregandoRuns(true);
    const resp = await fetch("/api/enrichment");
    if (resp.ok) {
      const data = await resp.json();
      setRunsAnteriores(data.runs || []);
    }
    setCarregandoRuns(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarRunsAnteriores();
  }, []);

  function pararPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function acompanhar(id: string) {
    pararPolling();
    setRunId(id);
    setRun(null);
    setRunLeads([]);

    async function poll() {
      const resp = await fetch(`/api/enrichment/${id}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setRun(data.run);
      setRunLeads(data.leads || []);
      if (data.run.status === "concluido" || data.run.status === "erro") {
        pararPolling();
        carregarRunsAnteriores();
      }
    }
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
  }

  useEffect(() => () => pararPolling(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadsValidos.length) return;
    setEnviando(true);
    setErro(null);

    const camposCustomizados = opcoes.camposCustomizadosTexto.split("\n").map((c) => c.trim()).filter(Boolean);

    const resp = await fetch("/api/enrichment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leads: leadsValidos.slice(0, LIMITE_LOTE),
        nivelRaciocinio: opcoes.nivelRaciocinio,
        buscarSocios: opcoes.buscarSocios,
        buscarFundacao: opcoes.buscarFundacao,
        buscarProcessos: opcoes.buscarProcessos,
        camposCustomizados,
      }),
    });
    const data = await resp.json();
    setEnviando(false);
    if (!resp.ok) {
      setErro(data.error || "Não foi possível iniciar o enriquecimento.");
      return;
    }
    setLeads([]);
    acompanhar(data.runId);
  }

  const processando = run && (run.status === "pendente" || run.status === "processando");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
          <CardDescription>
            Pra cada lead, uma IA com acesso à busca na web pesquisa ativamente (domínio do e-mail, nome no LinkedIn,
            telefone, e cruza essas pistas entre si) tentando descobrir em que empresa esse lead trabalha e outros
            dados comerciais sobre ela — sem inventar nada: só retorna um resultado quando encontra corroboração real
            ligando o lead à empresa, senão marca como &quot;não encontrado&quot; em vez de arriscar um palpite. Além
            do básico (empresa, cargo, site, LinkedIn), também busca um resumo com contexto sobre o negócio, e
            opcionalmente sócios, data de fundação, indício de processo judicial (JusBrasil) e qualquer outro dado que
            você definir em Opções avançadas.
          </CardDescription>
        </CardHeader>
      </Card>

      {!openaiKeyConfigurada && (
        <Alert>
          <AlertDescription>
            Você precisa cadastrar sua própria chave de API da OpenAI antes de usar esse recurso — vá em
            Configurações → OpenAI. O custo das buscas é cobrado na sua conta OpenAI, não consome créditos da
            plataforma.
          </AlertDescription>
        </Alert>
      )}

      {!runId && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <LeadStagingEditor leads={leads} onChange={setLeads} />
          <EnrichmentOptions value={opcoes} onChange={setOpcoes} />

          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" disabled={!leadsValidos.length || enviando || !openaiKeyConfigurada} className="self-start">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {enviando ? "Iniciando…" : `Enriquecer ${Math.min(leadsValidos.length, LIMITE_LOTE)} lead(s)`}
          </Button>
        </form>
      )}

      {runId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {processando && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                <Badge variant={run?.status === "erro" ? "destructive" : "outline"}>
                  {run?.status === "pendente" ? "Na fila…" : run?.status === "processando" ? "Processando…" : run?.status === "erro" ? "Erro" : "Concluído"}
                </Badge>
              </CardTitle>
              {run && <CardDescription>{run.processados} de {run.total} lead(s) processado(s)</CardDescription>}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { pararPolling(); setRunId(null); setRun(null); setRunLeads([]); }}>
              Nova execução
            </Button>
          </CardHeader>
          {run && (
            <CardContent className="flex flex-col gap-5">
              {run.status === "erro" && run.erro && (
                <Alert variant="destructive"><AlertDescription>{run.erro}</AlertDescription></Alert>
              )}
              {processando && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${run.total ? Math.round((run.processados / run.total) * 100) : 0}%` }}
                  />
                </div>
              )}
              {runLeads.length > 0 && <EnrichmentResults run={run} leads={runLeads} />}
            </CardContent>
          )}
        </Card>
      )}

      {!runId && runsAnteriores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><HistoryIcon className="h-4 w-4 text-primary" /> Execuções anteriores</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {carregandoRuns && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {runsAnteriores.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => acompanhar(r.id)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-secondary"
              >
                <div className="flex items-center gap-2.5">
                  <Badge variant={r.status === "erro" ? "destructive" : r.status === "concluido" ? "success" : "outline"}>
                    {r.status === "pendente" ? "Na fila" : r.status === "processando" ? "Processando" : r.status === "erro" ? "Erro" : "Concluído"}
                  </Badge>
                  <span className="text-sm">{r.total} lead(s) — {r.encontrados} encontrado(s)</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
