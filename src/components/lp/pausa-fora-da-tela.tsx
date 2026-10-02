"use client";

import { useEffect } from "react";

/**
 * Marca com `data-fora` as seções da página que estão fora da tela; o CSS
 * (lp.css) pausa as animações contínuas dentro delas. Quem está lendo não
 * vê diferença, e o navegador deixa de gastar quadros com o que não aparece.
 */
export function PausaForaDaTela() {
  useEffect(() => {
    const secoes = document.querySelectorAll<HTMLElement>(".lp main > section");
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) e.target.toggleAttribute("data-fora", !e.isIntersecting);
      },
      { rootMargin: "200px 0px" },
    );
    secoes.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);
  return null;
}
