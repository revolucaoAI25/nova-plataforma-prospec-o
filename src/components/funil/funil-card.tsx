"use client";

import { Building2, Phone, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onDragStart,
  onRemover,
}: {
  card: FunilCardRow;
  onDragStart: () => void;
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
      className="group flex cursor-grab flex-col gap-1.5 rounded-xl border border-border bg-secondary/60 p-3 text-sm transition-colors hover:border-border-strong active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-medium text-foreground">{nome}</span>
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
