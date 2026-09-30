"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { FLOW_NODE_CATEGORIAS, FLOW_NODE_TYPES_LIST } from "@/lib/flow/node-types";
import type { FlowNodeTipo } from "@/lib/database.types";
import { FLOW_NODE_ICONS, FLOW_CATEGORIA_CORES } from "./node-visuals";

export const FLOW_DRAG_DATA_FORMAT = "application/x-flow-node-tipo";

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Paleta de módulos, agrupada por categoria. Clique adiciona o módulo logo
 * depois do nó selecionado (ou no fim do caminho) já conectado; arrastar
 * pro canvas continua funcionando pra quem prefere posicionar à mão.
 */
export function FlowNodePalette({ onAdicionar, temGatilho }: { onAdicionar: (tipo: FlowNodeTipo) => void; temGatilho: boolean }) {
  const [busca, setBusca] = useState("");
  const termo = normalizar(busca.trim());

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar módulo" className="h-9 pl-8 text-sm" aria-label="Buscar módulo" />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-2">Clique pra adicionar depois do nó selecionado, ou arraste pro canvas.</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3">
        {FLOW_NODE_CATEGORIAS.map(({ categoria, label }) => {
          const tipos = FLOW_NODE_TYPES_LIST.filter(
            (t) => t.categoria === categoria && (!termo || normalizar(`${t.label} ${t.descricao}`).includes(termo)),
          );
          if (!tipos.length) return null;
          const cores = FLOW_CATEGORIA_CORES[categoria];
          const bloqueadoPorGatilho = categoria === "gatilho" && temGatilho;
          return (
            <div key={categoria} className="flex flex-col gap-1.5">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-2">{label}</p>
              {bloqueadoPorGatilho && <p className="px-1 text-[11px] text-muted-2">O fluxo já tem um gatilho. Remova-o pra trocar.</p>}
              {tipos.map((meta) => {
                const Icon = FLOW_NODE_ICONS[meta.icon];
                const desabilitado = !meta.disponivel || bloqueadoPorGatilho;
                return (
                  <button
                    key={meta.tipo}
                    type="button"
                    draggable={!desabilitado}
                    disabled={desabilitado}
                    onClick={() => onAdicionar(meta.tipo)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(FLOW_DRAG_DATA_FORMAT, meta.tipo);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn(
                      "group flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-secondary/40 px-2.5 py-2 text-left text-sm transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50",
                      cores.border,
                    )}
                    title={meta.descricao}
                  >
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", cores.bg, cores.text)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{meta.label}</span>
                    {!meta.disponivel ? (
                      <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">em breve</span>
                    ) : (
                      !desabilitado && <Plus className="h-3.5 w-3.5 shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
        {termo && !FLOW_NODE_TYPES_LIST.some((t) => normalizar(`${t.label} ${t.descricao}`).includes(termo)) && (
          <p className="px-1 text-sm text-muted-foreground">Nenhum módulo encontrado.</p>
        )}
      </div>
    </div>
  );
}
