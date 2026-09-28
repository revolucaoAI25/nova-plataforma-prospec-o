"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BigDataCorpResults } from "@/components/bigdatacorp/bigdatacorp-enrichment-results";
import type { BigDataCorpEnrichmentLeadRow, BigDataCorpEnrichmentRunRow } from "@/lib/database.types";

const LIMITE_LOTE = 50;
const POLL_MS = 2500;

function apenasDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/** Aceita um CNPJ por linha, opcionalmente com um nome antes separado por vírgula/tab/; ("Padaria do João, 12.345.678/0001-90"). */
function parseCnpjsColados(texto: string): Array<{ cnpj: string; nomeLead?: string }> {
  const itens: Array<{ cnpj: string; nomeLead?: string }> = [];
  for (const linhaBruta of (texto || "").split("\n")) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const partes = linha.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
    let cnpj = "";
    let nomeLead = "";
    for (const p of partes) {
      if (apenasDigitos(p).length >= 11 && !cnpj) cnpj = p;
      else if (!nomeLead) nomeLead = p;
    }
    if (apenasDigitos(cnpj).length === 14) itens.push({ cnpj, nomeLead: nomeLead || undefined });
  }
  return itens;
}

export function BigDataCorpEnrichmentPanel({ configurado }: { configurado: boolean }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<BigDataCorpEnrichmentRunRow | null>(null);
  const [runLeads, setRunLeads] = useState<BigDataCorpEnrichmentLeadRow[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const itens = parseCnpjsColados(texto);

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
    if (!itens.length) return;
    setEnviando(true);
    setErro(null);

    const resp = await fetch("/api/bigdatacorp-enrichment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: itens.slice(0, LIMITE_LOTE) }),
    });
    const data = await resp.json();
    setEnviando(false);
    if (!resp.ok) {
      setErro(data.error || "Não foi possível iniciar o enriquecimento.");
      return;
    }
    setTexto("");
    acompanhar(data.runId);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> Sócios e contato por CNPJ</CardTitle>
          <CardDescription>
            Cole uma lista de CNPJs (um por linha, opcionalmente com um nome antes, separado por vírgula) —
            consultamos cadastro, quadro societário e telefone/e-mail registrados de cada empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!configurado && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>Esse enriquecimento ainda não está configurado nesta plataforma — fale com o administrador.</AlertDescription>
            </Alert>
          )}
          {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={"12.345.678/0001-90\nPadaria do João, 98.765.432/0001-10"}
              className="min-h-40 font-mono text-sm"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{itens.length} CNPJ(s) reconhecido(s){itens.length > LIMITE_LOTE ? ` — só os primeiros ${LIMITE_LOTE} serão enviados` : ""}</span>
              <Button type="submit" disabled={!itens.length || enviando || !configurado}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {enviando ? "Enviando…" : "Enriquecer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {runId && run && <BigDataCorpResults run={run} leads={runLeads} />}
    </div>
  );
}
