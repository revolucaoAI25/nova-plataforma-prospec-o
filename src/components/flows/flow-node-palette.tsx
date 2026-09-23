"use client";

import { cn } from "@/lib/utils";
import { FLOW_NODE_CATEGORIAS, FLOW_NODE_TYPES_LIST } from "@/lib/flow/node-types";
import { FLOW_NODE_ICONS, FLOW_CATEGORIA_CORES } from "./node-visuals";

export const FLOW_DRAG_DATA_FORMAT = "application/x-flow-node-tipo";

/**
 * Paleta de módulos, agrupada por categoria — arraste pro canvas pra
 * adicionar. Cada módulo é um bloco reaproveitável e conectável livremente
 * (sem combinações pré-definidas), o usuário monta o fluxo que quiser.
 */
export function FlowNodePalette() {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3">
      {FLOW_NODE_CATEGORIAS.map(({ categoria, label }) => {
        const tipos = FLOW_NODE_TYPES_LIST.filter((t) => t.categoria === categoria);
        const cores = FLOW_CATEGORIA_CORES[categoria];
        return (
          <div key={categoria} className="flex flex-col gap-1.5">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-2">{label}</p>
            {tipos.map((meta) => {
              const Icon = FLOW_NODE_ICONS[meta.icon];
              return (
                <div
                  key={meta.tipo}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(FLOW_DRAG_DATA_FORMAT, meta.tipo);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className={cn(
                    "flex cursor-grab items-center gap-2 rounded-lg border bg-secondary/40 px-2.5 py-2 text-sm transition-colors hover:bg-secondary active:cursor-grabbing",
                    cores.border,
                  )}
                  title={meta.descricao}
                >
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", cores.bg, cores.text)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-foreground">{meta.label}</span>
                  {!meta.disponivel && (
                    <span className="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      em breve
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
