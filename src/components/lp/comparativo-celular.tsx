"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Celula, COLUNAS, type Valor } from "./comparativo-dados";

/**
 * Comparativo no celular: em vez da tabela de 5 colunas (que obrigava a
 * arrastar para o lado e mostrava só a coluna fixa), o Leadmatic aparece
 * lado a lado com UMA alternativa por vez, escolhida nos botões de cima.
 */
export function ComparativoCelular({ linhas }: { linhas: { criterio: string; valores: Valor[] }[] }) {
  const alternativas = COLUNAS.slice(1);
  const [escolhida, setEscolhida] = useState(1);
  const alternativa = COLUNAS[escolhida];

  return (
    <div className="lg:hidden">
      <p className="mb-3 font-lp-mono text-[11px] uppercase tracking-[0.12em] text-lp-muted-2">Comparar o Leadmatic com:</p>
      <div role="tablist" aria-label="Alternativa para comparar" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {alternativas.map((c, i) => {
          const indice = i + 1;
          const ativa = indice === escolhida;
          return (
            <button
              key={c.nome}
              type="button"
              role="tab"
              id={`comparar-${indice}`}
              aria-selected={ativa}
              aria-controls="comparativo-painel"
              onClick={() => setEscolhida(indice)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                ativa ? "border-lp-accent bg-lp-accent text-[#04140a]" : "border-lp-line-2 bg-lp-surface text-lp-muted hover:text-lp-text",
              )}
            >
              {c.nome}
            </button>
          );
        })}
      </div>

      <div id="comparativo-painel" role="tabpanel" aria-labelledby={`comparar-${escolhida}`} className="mt-4 overflow-clip rounded-[24px] border border-lp-line bg-lp-surface">
        <div className="sticky top-16 z-10 grid grid-cols-2 gap-3 border-b border-lp-line bg-lp-surface px-4 py-3.5">
          <div className="rounded-xl bg-lp-accent-soft px-3 py-2">
            <span className="block font-lp-display text-[15px] font-bold tracking-tight text-lp-glow">{COLUNAS[0].nome}</span>
            <span className="block font-lp-mono text-[9.5px] uppercase tracking-[0.1em] text-lp-muted-2">{COLUNAS[0].exemplo}</span>
          </div>
          <div className="px-3 py-2">
            <span className="block font-lp-display text-[15px] font-bold tracking-tight text-lp-text">{alternativa.nome}</span>
            <span className="block font-lp-mono text-[9.5px] uppercase tracking-[0.1em] text-lp-muted-2">{alternativa.exemplo}</span>
          </div>
        </div>
        <ul>
          {linhas.map((linha) => (
            <li key={linha.criterio} className="border-b border-lp-line/70 px-4 py-4 last:border-0">
              <p className="text-[14px] font-medium leading-snug text-lp-text">{linha.criterio}</p>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <div className="px-3">
                  <Celula valor={linha.valores[0]} destaque />
                </div>
                <div className="px-3">
                  <Celula valor={linha.valores[escolhida]} destaque={false} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
