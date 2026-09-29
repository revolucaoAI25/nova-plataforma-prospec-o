"use client";

import { Building2, Phone, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FunilCardRow } from "@/lib/database.types";

function campo(snapshot: Record<string, unknown>, ...chaves: string[]): string {
  for (const chave of chaves) {
    const v = snapshot[chave];
    if (v !== undefined && v !== null && String(v).trim()) return String(v);
  }
  return "";
}

export function FunilCardView({
  card,
  accentColor,
  dragging = false,
  onDragStart,
  onDragEnd,
  onRemover,
}: {
  card: FunilCardRow;
  accentColor?: string;
  dragging?: boolean;
  onDragStart: () => void;
  onDragEnd?: () => void;
  onRemover: () => void;
}) {
  const snapshot = card.lead_snapshot || {};
  const nome = campo(snapshot, "nome", "nome_completo", "razao_social") || "Sem nome";
  const empresa = campo(snapshot, "razao_social", "nome_fantasia");
  const telefone = campo(snapshot, "telefone", "telefone_internacional");
  const email = campo(snapshot, "email");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
      className={cn(
        "group flex cursor-grab flex-col gap-1.5 rounded-xl border border-l-[3px] border-border bg-secondary/60 p-3 text-sm shadow-sm transition-all active:cursor-grabbing",
        dragging ? "scale-[0.97] opacity-50" : "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-semibold text-foreground">{nome}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
          onClick={onRemover}
          title="Remover do funil"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {empresa && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" /> <span className="truncate">{empresa}</span>
        </div>
      )}
      {telefone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{telefone}</span>
        </div>
      )}
      {email && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{email}</span>
        </div>
      )}
    </div>
  );
}
