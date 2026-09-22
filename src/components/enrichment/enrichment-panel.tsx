"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Info, History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible } from "@/components/ui/collapsible";
import { LeadStagingEditor, type LeadStaged } from "@/components/enrichment/lead-staging-editor";
import { EnrichmentOptions, OPCOES_PADRAO, type OpcoesUI } from "@/components/enrichment/enrichment-options";
import { EnrichmentResults } from "@/components/enrichment/enrichment-results";
import type { EnrichmentLeadRow, EnrichmentRunRow } from "@/lib/database.types";

const LIMITE_LOTE = 50;
const POLL_MS = 2500;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Na fila…", processando: "Processando…", erro: "Erro", concluido: "Concluído",
};

export function EnrichmentPanel({ openaiKeyConfigurada }: { openaiKeyConfigurada: boolean }) {
  const [leads, setLeads] = useState<LeadStaged[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesUI>(OPCOES_PADRAO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<EnrichmentRunRow | null>(null);
  const [runLeads, setRunLeads] = useState<EnrichmentLeadRow[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const leadsValidos = leads.filter((l) => l.email.trim() || l.telefone.trim());

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
      if (data.run.status === "concluido" || data.run.status === "erro") pararPolling();
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Collapsible
          className="max-w-xl"
          trigger={
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <Info className="h-3.5 w-3.5" /> Como funciona
            </span>
          }
        >
          <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
            Pra cada lead, uma IA com acesso à busca na web pesquisa ativamente (domínio do e-mail, nome no LinkedIn,
            telefone, e cruza essas pistas entre si) tentando descobrir em que empresa esse lead trabalha e outros
            dados comerciais sobre ela — sem inventar nada: só retorna um resultado quando encontra corroboração real
            ligando o lead à empresa, senão marca como &quot;não encontrado&quot; em vez de arriscar um palpite.
          </p>
        </Collapsible>

        <Button asChild variant="ghost" size="sm">
          <Link href="/historico">
            <HistoryIcon className="h-3.5 w-3.5" /> Histórico de enriquecimentos
          </Link>
        </Button>
      </div>

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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <EnrichmentOptions value={opcoes} onChange={setOpcoes} />
          <LeadStagingEditor leads={leads} onChange={setLeads} />

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

      {runId && run && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2.5">
              {processando && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <Badge variant={run.status === "erro" ? "destructive" : run.status === "concluido" ? "success" : "outline"}>
                {STATUS_LABEL[run.status] ?? run.status}
              </Badge>
              <span className="text-sm text-muted-foreground">{run.processados} de {run.total} lead(s) processado(s)</span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { pararPolling(); setRunId(null); setRun(null); setRunLeads([]); }}>
              Nova execução
            </Button>
          </div>

          {run.status === "erro" && run.erro && (
            <Alert variant="destructive"><AlertDescription>{run.erro}</AlertDescription></Alert>
          )}
          {processando && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${run.total ? Math.round((run.processados / run.total) * 100) : 0}%` }}
              />
            </div>
          )}
          {runLeads.length > 0 && <EnrichmentResults run={run} leads={runLeads} />}
        </div>
      )}
    </div>
  );
}
