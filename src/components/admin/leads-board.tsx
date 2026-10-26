"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Mail, MessageCircle, Phone, Search, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-provider";
import { cn } from "@/lib/utils";
import { COLUNAS_LEAD, type ColunaLead, type LeadRow } from "@/lib/lp-leads-tipos";

const COR: Record<ColunaLead, string> = {
  preencheu: "#f5a623",
  em_contato: "#3b82f6",
  teste: "#a855f7",
  aguardando_pagamento: "#06b6d4",
  cliente: "#00c853",
  perdido: "#64748b",
};

const POR_COLUNA = 60;

function haQuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d < 31 ? `há ${d} d` : new Date(iso).toLocaleDateString("pt-BR");
}

function digitosWhatsApp(telefone: string | null | undefined): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

function mensagemWhatsApp(lead: LeadRow): string {
  const nome = (lead.nome ?? "").trim().split(/\s+/)[0];
  const oi = nome ? `Oi, ${nome}! ` : "Oi! ";
  const frase: Record<string, string> = {
    preencheu: "Vi que você começou o cadastro no Leadmatic e não concluiu. Ficou alguma dúvida que eu possa te ajudar?",
    teste: "Vi que você está testando o Leadmatic. Como está sendo? Posso te ajudar a tirar o máximo do teste?",
    aguardando_pagamento: "Vi que você criou a sua conta no Leadmatic, mas o pagamento não foi concluído. Ficou alguma dúvida?",
    cliente: "Seja bem-vindo ao Leadmatic! Posso te ajudar a montar a primeira campanha?",
  };
  return `${oi}Aqui é da equipe do Leadmatic. ${frase[lead.etapa] ?? ""}`.trim();
}

function origemDoLead(lead: LeadRow): string | null {
  const partes = [lead.utm_source, lead.utm_campaign, lead.utm_content].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

function csv(leads: LeadRow[]): string {
  const colunas: (keyof LeadRow)[] = ["nome", "email", "telefone", "empresa", "coluna", "etapa", "plano", "ciclo", "pagina", "utm_source", "utm_campaign", "utm_content", "notas", "criado_em", "atualizado_em"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [colunas.join(";"), ...leads.map((l) => colunas.map((c) => esc(l[c])).join(";"))].join("\n");
}

export function LeadsBoard({ leadsIniciais }: { leadsIniciais: LeadRow[] }) {
  const confirmar = useConfirm();
  const [leads, setLeads] = useState(leadsIniciais);
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<ColunaLead | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const termo = busca.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, "");
  const filtrados = useMemo(
    () =>
      leads.filter((l) => {
        if (!termo) return true;
        const texto = [l.nome, l.email, l.empresa, l.plano, l.utm_campaign, l.utm_content, l.notas].join(" ").toLowerCase();
        return texto.includes(termo) || (digitos.length >= 4 && (l.telefone ?? "").replace(/\D/g, "").includes(digitos));
      }),
    [leads, termo, digitos],
  );
  const porColuna = useMemo(() => {
    const mapa = new Map<ColunaLead, LeadRow[]>(COLUNAS_LEAD.map((c) => [c.id, []]));
    for (const l of filtrados) mapa.get(l.coluna)?.push(l);
    return mapa;
  }, [filtrados]);
  const leadAberto = aberto ? leads.find((l) => l.id === aberto) ?? null : null;

  function avisar(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 5000);
  }

  async function salvar(id: string, campos: { coluna?: ColunaLead; notas?: string }) {
    const antes = leads.find((l) => l.id === id);
    if (!antes) return;
    setLeads((lista) => lista.map((l) => (l.id === id ? { ...l, ...campos, atualizado_em: new Date().toISOString() } : l)));
    const resp = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campos),
    }).catch(() => null);
    if (!resp?.ok) {
      setLeads((lista) => lista.map((l) => (l.id === id ? antes : l)));
      avisar("Não foi possível salvar. Tente de novo.");
    }
  }

  async function remover(id: string) {
    if (!(await confirmar({ title: "Remover este lead do quadro?", description: "A conta da pessoa (se existir) não é afetada.", destructive: true }))) return;
    const resp = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" }).catch(() => null);
    if (!resp?.ok) return avisar("Não foi possível remover.");
    setLeads((lista) => lista.filter((l) => l.id !== id));
    setAberto(null);
  }

  function exportar() {
    const blob = new Blob(["﻿" + csv(filtrados)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-pagina-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <Alert variant="destructive">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, e-mail, telefone ou campanha" className="pl-9" aria-label="Buscar leads" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{filtrados.length} lead{filtrados.length === 1 ? "" : "s"}</span>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!filtrados.length}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        <div className="flex min-w-max gap-3">
          {COLUNAS_LEAD.map((coluna) => {
            const lista = porColuna.get(coluna.id) ?? [];
            return (
              <section
                key={coluna.id}
                aria-label={coluna.nome}
                onDragOver={(e) => {
                  if (!arrastando) return;
                  e.preventDefault();
                  setSobre(coluna.id);
                }}
                onDragLeave={() => setSobre((s) => (s === coluna.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const lead = leads.find((l) => l.id === arrastando);
                  if (lead && lead.coluna !== coluna.id) void salvar(lead.id, { coluna: coluna.id });
                  setArrastando(null);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col gap-2 rounded-2xl border border-border bg-card/60 p-2.5 transition-colors",
                  sobre === coluna.id && "border-primary/60 bg-accent/40",
                )}
              >
                <header className="flex flex-col gap-0.5 px-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COR[coluna.id] }} />
                    <h2 className="flex-1 truncate text-sm font-semibold text-foreground">{coluna.nome}</h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{lista.length}</span>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{coluna.dica}</p>
                </header>
                <div className="flex max-h-[calc(100dvh-320px)] min-h-24 flex-col gap-2 overflow-y-auto">
                  {lista.slice(0, POR_COLUNA).map((lead) => (
                    <CardLead
                      key={lead.id}
                      lead={lead}
                      cor={COR[coluna.id]}
                      arrastando={arrastando === lead.id}
                      onDragStart={() => setArrastando(lead.id)}
                      onDragEnd={() => {
                        setArrastando(null);
                        setSobre(null);
                      }}
                      onAbrir={() => setAberto(lead.id)}
                    />
                  ))}
                  {lista.length > POR_COLUNA && (
                    <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                      +{lista.length - POR_COLUNA} mais antigos. Use a busca ou exporte o CSV.
                    </p>
                  )}
                  {!lista.length && <p className="px-1 py-6 text-center text-xs text-muted-2">Nenhum lead aqui.</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {leadAberto && (
        <DetalheLead
          key={leadAberto.id}
          lead={leadAberto}
          onFechar={() => setAberto(null)}
          onMover={(coluna) => salvar(leadAberto.id, { coluna })}
          onNotas={(notas) => salvar(leadAberto.id, { notas })}
          onRemover={() => remover(leadAberto.id)}
        />
      )}
    </div>
  );
}

function CardLead({
  lead, cor, arrastando, onDragStart, onDragEnd, onAbrir,
}: {
  lead: LeadRow;
  cor: string;
  arrastando: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAbrir: () => void;
}) {
  const origem = origemDoLead(lead);
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onAbrir}
      style={{ borderLeftColor: cor }}
      className={cn(
        "flex w-full flex-col gap-1 rounded-xl border border-l-[3px] border-border bg-secondary/60 p-3 text-left text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing",
        arrastando ? "scale-[0.97] opacity-50" : "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 font-semibold text-foreground">{lead.nome || lead.email || lead.telefone || "Sem nome"}</span>
        <span className="shrink-0 text-[11px] text-muted-2">{haQuanto(lead.movido_em || lead.atualizado_em)}</span>
      </span>
      {lead.empresa && <span className="truncate text-xs text-muted-foreground">{lead.empresa}</span>}
      {lead.telefone && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" /> <span className="tabular-nums">{lead.telefone}</span>
        </span>
      )}
      <span className="mt-0.5 flex flex-wrap gap-1.5">
        {lead.plano && <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{lead.plano}</span>}
        {origem && <span className="max-w-full truncate rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">{origem}</span>}
        {lead.notas && (
          <span className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <StickyNote className="h-3 w-3" /> nota
          </span>
        )}
      </span>
    </button>
  );
}

function DetalheLead({
  lead, onFechar, onMover, onNotas, onRemover,
}: {
  lead: LeadRow;
  onFechar: () => void;
  onMover: (coluna: ColunaLead) => void;
  onNotas: (notas: string) => void;
  onRemover: () => void;
}) {
  const [notas, setNotas] = useState(lead.notas ?? "");
  const whats = digitosWhatsApp(lead.telefone);
  const origem = origemDoLead(lead);
  const linha = (rotulo: string, valor: React.ReactNode) =>
    valor ? (
      <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="min-w-0 text-right font-medium text-foreground [overflow-wrap:anywhere]">{valor}</span>
      </div>
    ) : null;

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead.nome || lead.email || "Lead sem nome"}</DialogTitle>
          <DialogDescription>
            {lead.empresa ? `${lead.empresa} · ` : ""}entrou {haQuanto(lead.criado_em)} pela página {lead.pagina === "teste" ? "do teste grátis" : "de contratação"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {whats && (
            <Button asChild size="sm">
              <a href={`https://wa.me/${whats}?text=${encodeURIComponent(mensagemWhatsApp(lead))}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
              </a>
            </Button>
          )}
          {lead.email && (
            <Button asChild size="sm" variant="outline">
              <a href={`mailto:${lead.email}`}>
                <Mail className="h-4 w-4" /> E-mail
              </a>
            </Button>
          )}
          {lead.user_id && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/${lead.user_id}`}>
                <ExternalLink className="h-4 w-4" /> Ver conta
              </Link>
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-border px-3">
          {linha("E-mail", lead.email)}
          {linha("WhatsApp", lead.telefone)}
          {linha("Plano", lead.plano ? `${lead.plano}${lead.ciclo ? ` (${lead.ciclo})` : ""}` : null)}
          {linha("Origem", origem)}
          {linha("Etapa alcançada", COLUNAS_LEAD.find((c) => c.id === lead.etapa)?.nome)}
          {linha("Última mudança", new Date(lead.movido_em).toLocaleString("pt-BR"))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Coluna no quadro</span>
          <Select value={lead.coluna} onValueChange={(v) => onMover(v as ColunaLead)}>
            <SelectTrigger aria-label="Coluna no quadro">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUNAS_LEAD.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Anotações</span>
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} placeholder="Ex.: chamei dia 12, pediu para retornar na semana que vem." />
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={onRemover} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Remover do quadro
            </Button>
            <Button size="sm" onClick={() => onNotas(notas)} disabled={notas === (lead.notas ?? "")}>
              Salvar anotações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
