"use client";

import { useState } from "react";
import { Users, CheckCircle2, CircleDashed, AlertTriangle, Download, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ResultsSummary, type SummaryMetric } from "@/components/search/results-summary";
import type { EnrichmentLeadRow, EnrichmentRunRow } from "@/lib/database.types";

const JUSBRASIL_LBL: Record<string, string> = { sim: "⚠️ Sim", nao: "✅ Não", nao_encontrado: "— Não encontrado" };

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "outline" | "destructive" | "secondary" }> = {
  pendente: { label: "Na fila…", variant: "outline" },
  concluido: { label: "Encontrado", variant: "success" },
  nao_encontrado: { label: "Não encontrado", variant: "secondary" },
  erro: { label: "Erro", variant: "destructive" },
};

function LeadCard({ lead }: { lead: EnrichmentLeadRow }) {
  const [aberto, setAberto] = useState(false);
  const titulo = lead.empresa_nome || lead.nome_lead || lead.email || lead.telefone || "Lead";
  const status = STATUS_BADGE[lead.status] ?? STATUS_BADGE.pendente;

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="truncate font-medium">{titulo}</span>
        </div>
        {aberto ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {aberto && (
        <div className="border-t border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 text-sm">
              <p><span className="text-muted-foreground">Nome:</span> {lead.nome_lead || "—"}</p>
              <p><span className="text-muted-foreground">E-mail:</span> {lead.email || "—"}</p>
              <p><span className="text-muted-foreground">Telefone:</span> {lead.telefone || "—"}</p>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              {lead.status === "concluido" ? (
                <>
                  <p><span className="text-muted-foreground">Empresa:</span> {lead.empresa_nome || "—"}</p>
                  <p><span className="text-muted-foreground">Cargo:</span> {lead.cargo || "—"}</p>
                  {(lead.municipio || lead.uf) && <p><span className="text-muted-foreground">Cidade/UF:</span> {lead.municipio}{lead.uf ? `/${lead.uf}` : ""}</p>}
                  {lead.website && (
                    <p className="flex items-center gap-1">
                      <span className="text-muted-foreground">Site:</span>{" "}
                      <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        {lead.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  )}
                  {lead.linkedin_url && (
                    <p className="flex items-center gap-1">
                      <span className="text-muted-foreground">LinkedIn:</span>{" "}
                      <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        Perfil <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  )}
                  {lead.cnpj && <p><span className="text-muted-foreground">CNPJ:</span> {lead.cnpj}</p>}
                  {lead.socios && <p><span className="text-muted-foreground">Sócios:</span> {lead.socios}</p>}
                  {lead.fundacao && <p><span className="text-muted-foreground">Fundação:</span> {lead.fundacao}</p>}
                  {lead.processos_jusbrasil && (
                    <p><span className="text-muted-foreground">Processo (JusBrasil):</span> {JUSBRASIL_LBL[lead.processos_jusbrasil] || lead.processos_jusbrasil}</p>
                  )}
                  {lead.extras && Object.entries(lead.extras).map(([k, v]) => v ? <p key={k}><span className="text-muted-foreground">{k}:</span> {v}</p> : null)}
                </>
              ) : lead.status === "erro" ? (
                <p className="text-destructive">{lead.erro || "Erro desconhecido ao processar esse lead."}</p>
              ) : lead.status === "pendente" ? (
                <p className="text-muted-foreground">Ainda não processado.</p>
              ) : (
                <p className="text-muted-foreground">Nenhuma empresa identificada com confiança suficiente.</p>
              )}
            </div>
          </div>
          {lead.resumo && (
            <p className="mt-3 rounded-lg bg-accent p-3 text-sm text-accent-foreground">{lead.resumo}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function EnrichmentResults({ run, leads }: { run: EnrichmentRunRow; leads: EnrichmentLeadRow[] }) {
  const metrics: SummaryMetric[] = [
    { icon: Users, label: "Total processados", value: run.processados, hint: `de ${run.total}`, tone: "primary" },
    { icon: CheckCircle2, label: "Encontrados", value: run.encontrados, tone: "info" },
    { icon: CircleDashed, label: "Não encontrados", value: run.nao_encontrados, tone: "violet" },
    { icon: AlertTriangle, label: "Erros", value: run.erros, tone: "destructive" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ResultsSummary metrics={metrics} />

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Visão geral</CardTitle>
          {run.status === "concluido" && (
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/enrichment/${run.id}/export`}>
                  <Download className="h-4 w-4" /> Excel
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/enrichment/${run.id}/export?formato=csv`}>
                  <Download className="h-4 w-4" /> CSV
                </a>
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Cidade/UF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => {
                const status = STATUS_BADGE[l.status] ?? STATUS_BADGE.pendente;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="max-w-[180px] truncate font-medium">{l.nome_lead || l.email || l.telefone || "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{l.email || "—"}</TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    <TableCell className="max-w-[160px] truncate">{l.empresa_nome || "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{l.cargo || "—"}</TableCell>
                    <TableCell>{[l.municipio, l.uf].filter(Boolean).join("/") || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Detalhe por lead</h3>
        {leads.map((l) => <LeadCard key={l.id} lead={l} />)}
      </div>
    </div>
  );
}
