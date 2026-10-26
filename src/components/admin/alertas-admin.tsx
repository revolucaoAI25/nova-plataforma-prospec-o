"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertaAdminRow } from "@/lib/alertas-admin";

/** Avisos para o admin no topo das telas (consumo do provedor de buscas etc.). */
export function AlertasAdmin({ alertas }: { alertas: AlertaAdminRow[] }) {
  const [abertos, setAbertos] = useState(alertas);
  if (!abertos.length) return null;

  async function resolver(id: number) {
    setAbertos((lista) => lista.filter((a) => a.id !== id));
    await fetch("/api/admin/alertas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  }

  return (
    <div className="mb-6 flex flex-col gap-2" role="region" aria-label="Avisos do administrador">
      {abertos.map((a) => {
        const critico = a.nivel === "critico";
        const Icone = critico ? AlertTriangle : Info;
        return (
          <div
            key={a.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 text-sm",
              critico ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10",
            )}
          >
            <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", critico ? "text-destructive" : "text-amber-600 dark:text-amber-400")} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">
                {a.titulo} <span className="ml-1 text-xs font-normal text-muted-foreground">· só admins veem</span>
              </p>
              <p className="mt-0.5 text-muted-foreground">{a.mensagem}</p>
              {a.link && (
                <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => resolver(a.id)}
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Marcar aviso como resolvido"
            >
              <X className="h-3.5 w-3.5" /> Resolvido
            </button>
          </div>
        );
      })}
    </div>
  );
}
