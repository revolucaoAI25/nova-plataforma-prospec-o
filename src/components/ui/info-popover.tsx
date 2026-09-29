"use client";

import { Info } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/**
 * Ícone "?" que abre a explicação completa sob demanda, em vez de deixar o
 * parágrafo inteiro sempre visível abaixo do campo — reduz a densidade de
 * texto da tela sem esconder a informação (pedido explícito: menos texto
 * sempre visível, mas "expande se necessário" com um popover).
 */
export function InfoPopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Isola o clique do <label> que costuma envolver isto (ex: FieldRow) —
          // sem isto, clicar no ícone também ativaria o switch/controle
          // associado por wrapping implícito. stopPropagation (não
          // preventDefault) porque o handler do próprio Radix está no MESMO
          // elemento, não num ancestral — só precisa parar de subir.
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          title="Mais detalhes"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="text-xs leading-relaxed text-muted-foreground">{children}</PopoverContent>
    </Popover>
  );
}
