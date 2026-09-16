"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  group?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Buscar…",
  emptyLabel = "Nenhuma opção encontrada.",
  className,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const [termo, setTermo] = useState("");

  const filtradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t) || o.value.toLowerCase().includes(t));
  }, [options, termo]);

  const selectedSet = new Set(selected);

  function toggle(value: string) {
    if (selectedSet.has(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  const labelFor = (value: string) => options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {labelFor(v)}
              <button type="button" onClick={() => toggle(v)} className="rounded-full hover:bg-border">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-border">
        {filtradas.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          filtradas.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => toggle(o.value)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-secondary",
                selectedSet.has(o.value) && "bg-accent text-accent-foreground",
              )}
            >
              <span>{o.label}</span>
              {o.group && <span className="text-xs text-muted-foreground">{o.group}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
