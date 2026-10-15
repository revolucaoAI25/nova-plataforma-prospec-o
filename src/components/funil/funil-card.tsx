"use client";

import { useMemo } from "react";
import { Phone, Mail, StickyNote, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { resumoDoCard } from "@/lib/funil-resumo";
import type { FunilCardRow } from "@/lib/database.types";

/**
 * Card do board: o essencial do negócio (empresa, quem é o contato, o
 * telefone principal e quantos contatos a mais ele tem). Clique abre o
 * detalhe com todos os telefones, histórico e ações; arrastar move.
 */
export function FunilCardView({
  card,
  accentColor,
  dragging = false,
  onDragStart,
  onDragEnd,
  onAbrir,
}: {
  card: FunilCardRow;
  accentColor?: string;
  dragging?: boolean;
  onDragStart: () => void;
  onDragEnd?: () => void;
  onAbrir: () => void;
}) {
  const r = useMemo(() => resumoDoCard(card.lead_snapshot || {}), [card.lead_snapshot]);
  const principal = r.telefones[0];
  const extras = r.telefones.length - 1 + Math.max(0, r.emails.length - 1);

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onAbrir}
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
      className={cn(
        "group flex w-full cursor-pointer flex-col gap-1.5 rounded-xl border border-l-[3px] border-border bg-secondary/60 p-3 text-left text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing",
        dragging ? "scale-[0.97] opacity-50" : "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
      )}
    >
      <span className="line-clamp-2 font-semibold leading-snug text-foreground">{r.titulo}</span>
      {r.subtitulo && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className="h-3 w-3 shrink-0" /> <span className="truncate">{r.subtitulo}</span>
        </span>
      )}
      {principal ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          <span className="truncate tabular-nums">{principal.exibicao}</span>
          {r.telefones.length > 1 && <span className="shrink-0 text-muted-2">· {principal.rotulo.toLowerCase()}</span>}
        </span>
      ) : r.emails[0] ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{r.emails[0]}</span>
        </span>
      ) : null}
      {(extras > 0 || card.anotacoes) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {extras > 0 && (
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              +{extras} contato{extras > 1 ? "s" : ""}
            </span>
          )}
          {card.anotacoes && (
            <span className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <StickyNote className="h-3 w-3" /> nota
            </span>
          )}
        </span>
      )}
    </button>
  );
}
