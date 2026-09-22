import type { LucideIcon } from "lucide-react";
import { Users, Phone, Globe, Mail, Star, AtSign, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type SummaryTone = "primary" | "info" | "violet" | "amber" | "destructive";

const TONE_CLASSES: Record<SummaryTone, string> = {
  primary: "bg-accent text-primary",
  info: "bg-info-soft text-info",
  violet: "bg-violet-soft text-violet",
  amber: "bg-amber-soft text-amber",
  destructive: "bg-destructive-soft text-destructive",
};

export interface SummaryMetric {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: SummaryTone;
}

/** Painel de estatísticas rápidas exibido logo após uma busca — quantos
 * resultados vieram e quantos têm cada tipo de contato, de forma visual em
 * vez de só um número cru. Portado (e melhorado) de app.py `_stats()`. */
export function ResultsSummary({ metrics }: { metrics: SummaryMetric[] }) {
  if (!metrics.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[m.tone ?? "primary"])}>
            <m.icon className="h-4.5 w-4.5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-xl font-bold tabular-nums leading-tight text-foreground">{m.value}</span>
            <span className="truncate text-xs text-muted-foreground">
              {m.label}
              {m.hint ? ` · ${m.hint}` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function pct(count: number, total: number): string {
  return total ? `${Math.round((count / total) * 100)}%` : "0%";
}

interface LeadLike {
  telefone?: string | null;
  telefone2?: string | null;
  site?: string | null;
  email?: string | null;
  avaliacao?: number | string | null;
}

/** Métricas para leads de CNPJ/Maps: total, com telefone, com site, com
 * e-mail — e avaliação média, só quando a busca de fato trouxe avaliações
 * (Maps), pra não mostrar "0" sem sentido pra quem buscou só por CNPJ. */
export function buildGeneralMetrics(leads: LeadLike[]): SummaryMetric[] {
  const total = leads.length;
  const comTelefone = leads.filter((r) => r.telefone || r.telefone2).length;
  const comSite = leads.filter((r) => r.site).length;
  const comEmail = leads.filter((r) => r.email).length;

  const avaliacoes = leads
    .map((r) => (r.avaliacao === "" || r.avaliacao == null ? null : Number(r.avaliacao)))
    .filter((v): v is number => v != null && !Number.isNaN(v));

  const metrics: SummaryMetric[] = [
    { icon: Users, label: "Total de leads", value: total, tone: "primary" },
    { icon: Phone, label: "Com telefone", value: comTelefone, hint: pct(comTelefone, total), tone: "info" },
    { icon: Globe, label: "Com site", value: comSite, hint: pct(comSite, total), tone: "violet" },
    { icon: Mail, label: "Com e-mail", value: comEmail, hint: pct(comEmail, total), tone: "amber" },
  ];

  if (avaliacoes.length) {
    const media = avaliacoes.reduce((a, b) => a + b, 0) / avaliacoes.length;
    metrics.push({ icon: Star, label: "Avaliação média", value: media.toFixed(1), hint: `${avaliacoes.length} avaliados`, tone: "amber" });
  }

  return metrics;
}

interface InstagramLeadLike {
  site?: string | null;
  email?: string | null;
  bio?: string | null;
  is_business?: boolean | null;
  followers_count?: number | string | null;
}

/** Métricas para leads de Instagram — não tem telefone/CNPJ, então troca
 * por bio/contas business/seguidores, que são os dados que a extração
 * realmente traz. */
export function buildInstagramMetrics(leads: InstagramLeadLike[]): SummaryMetric[] {
  const total = leads.length;
  const comBio = leads.filter((r) => r.bio).length;
  const comEmail = leads.filter((r) => r.email).length;
  const comSite = leads.filter((r) => r.site).length;
  const business = leads.filter((r) => r.is_business).length;

  const seguidores = leads
    .map((r) => (r.followers_count === "" || r.followers_count == null ? null : Number(r.followers_count)))
    .filter((v): v is number => v != null && !Number.isNaN(v) && v > 0);

  const metrics: SummaryMetric[] = [
    { icon: Users, label: "Total de perfis", value: total, tone: "primary" },
    { icon: AtSign, label: "Com bio", value: comBio, hint: pct(comBio, total), tone: "info" },
    { icon: Mail, label: "Com e-mail", value: comEmail, hint: pct(comEmail, total), tone: "amber" },
    { icon: Globe, label: "Com site", value: comSite, hint: pct(comSite, total), tone: "violet" },
  ];

  if (business > 0) {
    metrics.push({ icon: BadgeCheck, label: "Contas business", value: business, hint: pct(business, total), tone: "violet" });
  }
  if (seguidores.length) {
    const media = Math.round(seguidores.reduce((a, b) => a + b, 0) / seguidores.length);
    metrics.push({ icon: Star, label: "Seguidores (média)", value: media.toLocaleString("pt-BR"), tone: "info" });
  }

  return metrics;
}
