"use client";

import { useEffect, useState } from "react";
import { BarChart3, Users, Clock, CheckCircle2, XCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import type { BadgeProps } from "@/components/ui/badge";
import type { EmailCampaignRow, EmailTargetRow } from "@/lib/database.types";

const TARGET_STATUS_LABEL: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  pendente: { label: "Pendente", variant: "outline" },
  enviando: { label: "Enviando…", variant: "secondary" },
  enviado: { label: "Enviado", variant: "success" },
  concluido: { label: "Concluído", variant: "success" },
  falhou: { label: "Falhou", variant: "destructive" },
  removido: { label: "Removido", variant: "outline" },
};

const ORIGEM_LABEL: Record<string, string> = {
  busca_existente: "Busca existente",
  upload: "Upload de planilha",
  manual: "Manual",
  auto_trigger: "Gatilho por filtro",
  sheet_watch: "Monitorando planilha",
};

export function ReportsPanel({ campanhasIniciais }: { campanhasIniciais: EmailCampaignRow[] }) {
  const [campaignId, setCampaignId] = useState(campanhasIniciais[0]?.id ?? "");
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [targets, setTargets] = useState<EmailTargetRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const campanha = campanhasIniciais.find((c) => c.id === campaignId);

  useEffect(() => {
    if (!campaignId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      fetch(`/api/email-dispatch/campaigns/${campaignId}`).then((r) => r.json()),
      fetch(`/api/email-dispatch/campaigns/${campaignId}/targets`).then((r) => r.json()),
    ]).then(([campData, targetsData]) => {
      setStats(campData.stats || null);
      setTargets(targetsData.targets || []);
      setLoading(false);
    });
  }, [campaignId]);

  if (campanhasIniciais.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Relatórios</CardTitle>
          <CardDescription>Nenhuma campanha ainda.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Relatórios</CardTitle>
        <CardDescription>Métricas e alvos de uma campanha específica.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Escolher campanha" /></SelectTrigger>
            <SelectContent>
              {campanhasIniciais.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} — {ORIGEM_LABEL[c.tipo_origem] ?? c.tipo_origem} ({c.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {campanha && <Badge variant={campanha.status === "ativa" ? "success" : "outline"}>{campanha.status}</Badge>}
        </div>

        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Inscritos" value={stats.total ?? 0} icon={Users} tone="info" />
            <StatCard label="Pendentes" value={stats.pendente ?? 0} icon={Clock} tone="amber" />
            <StatCard label="Concluídos" value={stats.concluido ?? 0} icon={CheckCircle2} tone="primary" />
            <StatCard label="Falharam" value={stats.falhou ?? 0} icon={XCircle} tone="destructive" />
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {targets && (
          targets.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum alvo inscrito nesta campanha" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próxima etapa</TableHead>
                  <TableHead>Atualizado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.slice(0, 200).map((t) => {
                  const s = TARGET_STATUS_LABEL[t.status] ?? { label: t.status, variant: "outline" as const };
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-[220px] truncate font-medium">{t.nome || "—"}</TableCell>
                      <TableCell>{t.email}</TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      <TableCell>{t.proxima_etapa_em ? new Date(t.proxima_etapa_em).toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell>{new Date(t.atualizado_em).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        )}
      </CardContent>
    </Card>
  );
}
