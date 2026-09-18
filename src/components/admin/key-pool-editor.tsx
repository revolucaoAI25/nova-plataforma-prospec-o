"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiKeyPoolEntry } from "@/lib/database.types";

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Editor de pool de chaves com rodízio mensal — antes era um textarea de
 * JSON cru (fácil de quebrar a sintaxe e travar o salvamento ao tentar
 * adicionar uma segunda chave). Cada linha edita um ApiKeyPoolEntry.
 */
export function KeyPoolEditor({
  value,
  onChange,
  keyPlaceholder,
}: {
  value: ApiKeyPoolEntry[];
  onChange: (next: ApiKeyPoolEntry[]) => void;
  keyPlaceholder?: string;
}) {
  function addRow() {
    onChange([...value, { key: "", nickname: "", limit: 900, usage: 0, text_search_usage: 0, month: mesAtual() }]);
  }
  function removeRow(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function updateRow(idx: number, patch: Partial<ApiKeyPoolEntry>) {
    onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && (
        <p className="rounded-xl border border-dashed border-border-strong p-4 text-center text-sm text-muted-foreground">
          Nenhuma chave no pool — a plataforma usa a chave padrão, sem rodízio.
        </p>
      )}
      {value.map((row, idx) => (
        <div key={idx} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-end">
          <div className="flex w-full flex-col gap-1.5 sm:w-32">
            <Label htmlFor={`pool-nick-${idx}`}>Apelido</Label>
            <Input
              id={`pool-nick-${idx}`}
              value={row.nickname ?? ""}
              onChange={(e) => updateRow(idx, { nickname: e.target.value })}
              placeholder={`Chave ${idx + 1}`}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor={`pool-key-${idx}`}>Chave API</Label>
            <Input
              id={`pool-key-${idx}`}
              type="password"
              value={row.key}
              onChange={(e) => updateRow(idx, { key: e.target.value })}
              placeholder={keyPlaceholder}
            />
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-36">
            <Label htmlFor={`pool-limit-${idx}`}>Limite mensal</Label>
            <Input
              id={`pool-limit-${idx}`}
              type="number"
              min={0}
              value={row.limit}
              onChange={(e) => updateRow(idx, { limit: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1.5">
            <p className="text-xs text-muted-foreground">
              Uso em {row.month}: <span className="tabular-nums text-foreground">{row.usage}</span>
              {row.text_search_usage ? ` (+${row.text_search_usage} busca textual)` : ""}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(idx)}
              title="Remover chave"
              className="text-destructive hover:bg-destructive-soft hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="self-start">
        <Plus className="h-4 w-4" /> Adicionar chave
      </Button>
    </div>
  );
}
