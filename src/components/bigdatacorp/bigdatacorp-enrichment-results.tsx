"use client";

import { useState } from "react";
import { Building2, CheckCircle2, CircleDashed, AlertTriangle, ChevronDown, ChevronUp, Phone, Mail, Users2, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ResultsSummary, type SummaryMetric } from "@/components/search/results-summary";
import type { BigDataCorpEnrichmentLeadRow, BigDataCorpEnrichmentRunRow, BigDataCorpSocioRow } from "@/lib/database.types";
import { formatarExibicao } from "@/lib/phone";

function CelularSocio({ numero, whatsapp }: { numero: string; whatsapp?: boolean | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {formatarExibicao(numero)}
      {/* span, não Badge (div): aparece dentro de <p> */}
      {whatsapp && <span className="rounded-full bg-success px-1.5 text-[10px] font-semibold text-success-foreground">WhatsApp</span>}
    </span>
  );
}

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "outline" | "destructive" | "secondary" }> = {
  pendente: { label: "Na fila…", variant: "outline" },
  concluido: { label: "Encontrado", variant: "success" },
  nao_encontrado: { label: "Não encontrado", variant: "secondary" },
  erro: { label: "Erro", variant: "destructive" },
};

function sociosArray(socios: BigDataCorpEnrichmentLeadRow["socios"]): BigDataCorpSocioRow[] {
  return Array.isArray(socios) ? (socios as BigDataCorpSocioRow[]) : [];
}

function LeadCard({ lead }: { lead: BigDataCorpEnrichmentLeadRow }) {
  const [aberto, setAberto] = useState(false);
  const titulo = lead.razao_social || lead.nome_lead || lead.cnpj_entrada;
  const status = STATUS_BADGE[lead.status] ?? STATUS_BADGE.pendente;
  const socios = sociosArray(lead.socios);

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
              <p><span className="text-muted-foreground">CNPJ:</span> {lead.cnpj_entrada}</p>
              {lead.nome_lead && <p><span className="text-muted-foreground">Nome informado:</span> {lead.nome_lead}</p>}
              {lead.razao_social && <p><span className="text-muted-foreground">Razão social:</span> {lead.razao_social}</p>}
              {lead.endereco && <p><span className="text-muted-foreground">Endereço:</span> {lead.endereco}</p>}
            </div>
            <div className="flex flex-col gap-1 text-sm">
              {lead.status === "concluido" ? (
                <>
                  {lead.socio_celular && (
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      <Smartphone className="h-3.5 w-3.5 text-primary" /> {lead.socio_nome}: <CelularSocio numero={lead.socio_celular} whatsapp={lead.socio_whatsapp} />
                    </p>
                  )}
                  {lead.telefone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> Empresa: {formatarExibicao(lead.telefone)}</p>}
                  {lead.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {lead.email}</p>}
                  {!lead.telefone && !lead.email && <p className="text-muted-foreground">Empresa encontrada, sem telefone/e-mail cadastrado.</p>}
                  {socios.length > 0 && (
                    <div className="mt-1">
                      <p className="flex items-center gap-1.5 text-muted-foreground"><Users2 className="h-3.5 w-3.5" /> Sócios/quadro societário:</p>
                      <ul className="ml-5 list-disc">
                        {socios.map((s, i) => (
                          <li key={i}>
                            {s.nome}{s.qualificacao ? ` — ${s.qualificacao}` : ""}
                            {s.celular ? <> · <CelularSocio numero={s.celular} whatsapp={s.whatsapp} /></> : s.celular === null ? " · sem celular" : ""}
                            {s.outros?.length ? <span className="text-muted-foreground"> (outros: {s.outros.map(formatarExibicao).join(", ")})</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lead.erro && <p className="text-xs text-muted-foreground">{lead.erro}</p>}
                </>
              ) : lead.status === "erro" ? (
                <p className="text-destructive">{lead.erro || "Erro desconhecido ao consultar esse CNPJ."}</p>
              ) : lead.status === "pendente" ? (
                <p className="text-muted-foreground">Ainda não processado.</p>
              ) : (
                <p className="text-muted-foreground">Nenhum registro encontrado pra esse CNPJ.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BigDataCorpResults({ run, leads }: { run: BigDataCorpEnrichmentRunRow; leads: BigDataCorpEnrichmentLeadRow[] }) {
  // Execuções do celular do sócio mostram o que importa: quantas empresas
  // saíram com o celular. As antigas (só contato da empresa) não têm isso.
  const comCelular = leads.some((l) => l.socio_celular || l.socio_nome) || run.com_celular > 0;
  const metrics: SummaryMetric[] = comCelular
    ? [
        { icon: Building2, label: "Empresas processadas", value: run.processados, hint: `de ${run.total}`, tone: "primary" },
        { icon: Smartphone, label: "Com celular do sócio", value: run.com_celular, tone: "info" },
        { icon: CircleDashed, label: "Sem celular", value: Math.max(run.processados - run.com_celular - run.erros, 0), tone: "violet" },
        { icon: AlertTriangle, label: "Erros", value: run.erros, tone: "destructive" },
      ]
    : [
        { icon: Building2, label: "Total processados", value: run.processados, hint: `de ${run.total}`, tone: "primary" },
        { icon: CheckCircle2, label: "Encontrados", value: run.encontrados, tone: "info" },
        { icon: CircleDashed, label: "Não encontrados", value: run.nao_encontrados, tone: "violet" },
        { icon: AlertTriangle, label: "Erros", value: run.erros, tone: "destructive" },
      ];

  return (
    <div className="flex flex-col gap-5">
      <ResultsSummary metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visão geral</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CNPJ</TableHead>
                <TableHead>Razão social</TableHead>
                <TableHead>Status</TableHead>
                {comCelular && <TableHead>Sócio</TableHead>}
                {comCelular && <TableHead>Celular do sócio</TableHead>}
                <TableHead>{comCelular ? "Telefone da empresa" : "Telefone"}</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Sócios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => {
                const status = STATUS_BADGE[l.status] ?? STATUS_BADGE.pendente;
                const socios = sociosArray(l.socios);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.cnpj_entrada}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.razao_social || "—"}</TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    {comCelular && <TableCell className="max-w-[180px] truncate">{l.socio_nome || "—"}</TableCell>}
                    {comCelular && <TableCell>{l.socio_celular ? <CelularSocio numero={l.socio_celular} whatsapp={l.socio_whatsapp} /> : "—"}</TableCell>}
                    <TableCell className="whitespace-nowrap">{l.telefone ? formatarExibicao(l.telefone) : "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{l.email || "—"}</TableCell>
                    <TableCell>{socios.length ? `${socios.length} sócio(s)` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Detalhe por CNPJ</h3>
        {leads.map((l) => <LeadCard key={l.id} lead={l} />)}
      </div>
    </div>
  );
}
