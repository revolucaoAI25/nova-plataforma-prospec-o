"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldGroup, FieldRow } from "@/components/ui/field-group";
import { CreditoEstimado } from "@/components/search/credito-estimado";
import { BigDataCorpResults } from "@/components/bigdatacorp/bigdatacorp-enrichment-results";
import { BigDataCorpLeadStagingEditor, type BigDataCorpLeadStaged } from "@/components/bigdatacorp/bigdatacorp-lead-staging-editor";
import type { BigDataCorpEnrichmentLeadRow, BigDataCorpEnrichmentRunRow, OpcoesCelularSocio } from "@/lib/database.types";

const LIMITE_LOTE = 50;
const POLL_MS = 2500;

export function BigDataCorpEnrichmentPanel({
  configurado,
  celularSocio = false,
  custos = {},
}: {
  configurado: boolean;
  /** A consulta acha o celular do sócio (não só o contato da empresa). */
  celularSocio?: boolean;
  custos?: Record<string, number>;
}) {
  const [leads, setLeads] = useState<BigDataCorpLeadStaged[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesCelularSocio>({ socios: "administrador", maxSocios: 2, soWhatsapp: true, respeitarBloqueio: true });
  const mudar = (patch: Partial<OpcoesCelularSocio>) => setOpcoes((o) => ({ ...o, ...patch }));
  const sociosConsultados = opcoes.socios === "todos" ? opcoes.maxSocios : 1;
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
      body: JSON.stringify({ itens: leads.slice(0, LIMITE_LOTE), ...(celularSocio ? { opcoes } : {}) }),
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
        {celularSocio && (
          <FieldGroup>
            <div className="flex flex-col gap-2 p-3.5">
              <p className="text-sm font-medium">De quais sócios buscar o celular</p>
              <RadioGroup
                value={opcoes.socios === "todos" ? String(opcoes.maxSocios) : "administrador"}
                onValueChange={(v) => mudar(v === "administrador" ? { socios: "administrador" } : { socios: "todos", maxSocios: Number(v) })}
                className="flex flex-wrap gap-4"
              >
                {([
                  ["administrador", "Só o administrador"],
                  ["2", "Até 2 sócios"],
                  ["3", "Até 3 sócios"],
                ] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={value} id={`socios-enriq-${value}`} />
                    {label}
                  </label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Cada sócio consultado é cobrado à parte. Sem administrador, vale o primeiro sócio pessoa física.
              </p>
            </div>
            <FieldRow
              label="Só celular com WhatsApp"
              info="Descarta celulares sem indicação de WhatsApp. Desligue se o contato for por ligação."
              control={<Switch checked={opcoes.soWhatsapp} onCheckedChange={(v) => mudar({ soWhatsapp: v })} />}
            />
            <FieldRow
              label="Respeitar bloqueio de telemarketing"
              info="Descarta números cadastrados no bloqueio de telemarketing (Não Me Perturbe)."
              control={<Switch checked={opcoes.respeitarBloqueio} onCheckedChange={(v) => mudar({ respeitarBloqueio: v })} />}
            />
          </FieldGroup>
        )}
        <div className="flex flex-col gap-2 self-start">
          <Button type="submit" size="lg" disabled={!leads.length || enviando || !configurado}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {enviando ? "Enviando…" : celularSocio ? "Buscar celular do sócio" : "Enriquecer"}
          </Button>
          <CreditoEstimado
            custoPorUnidade={(custos.bigdatacorp || 0) + (celularSocio ? (custos.socio_celular || 0) * sociosConsultados : 0)}
            unidade="empresa"
            nota={celularSocio ? "no máximo; cada consulta é cobrada, achando o celular ou não" : "cobrado por consulta feita"}
          />
        </div>
      </form>

      {runId && run && <BigDataCorpResults run={run} leads={runLeads} />}
    </div>
  );
}
