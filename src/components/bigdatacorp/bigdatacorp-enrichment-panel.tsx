"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BigDataCorpResults } from "@/components/bigdatacorp/bigdatacorp-enrichment-results";
import { BigDataCorpLeadStagingEditor, type BigDataCorpLeadStaged } from "@/components/bigdatacorp/bigdatacorp-lead-staging-editor";
import type { BigDataCorpEnrichmentLeadRow, BigDataCorpEnrichmentRunRow } from "@/lib/database.types";

const LIMITE_LOTE = 50;
const POLL_MS = 2500;

export function BigDataCorpEnrichmentPanel({ configurado }: { configurado: boolean }) {
  const [leads, setLeads] = useState<BigDataCorpLeadStaged[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<BigDataCorpEnrichmentRunRow | null>(null);
  const [runLeads, setRunLeads] = useState<BigDataCorpEnrichmentLeadRow[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const resp = await fetch(`/api/bigdatacorp-enrichment/${id}`);
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
    if (!leads.length) return;
    setEnviando(true);
    setErro(null);

    const resp = await fetch("/api/bigdatacorp-enrichment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: leads.slice(0, LIMITE_LOTE) }),
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

  return (
    <div className="flex flex-col gap-5">
      {!configurado && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>Esse enriquecimento ainda não está configurado nesta plataforma — fale com o administrador.</AlertDescription>
        </Alert>
      )}
      {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <BigDataCorpLeadStagingEditor leads={leads} onChange={setLeads} />
        <Button type="submit" size="lg" disabled={!leads.length || enviando || !configurado} className="self-start">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {enviando ? "Enviando…" : "Enriquecer"}
        </Button>
      </form>

      {runId && run && <BigDataCorpResults run={run} leads={runLeads} />}
    </div>
  );
}
