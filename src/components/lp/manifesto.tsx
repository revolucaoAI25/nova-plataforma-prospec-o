"use client";

import { useEffect, useRef } from "react";

const FRASES: { texto: string; destaque?: boolean }[] = [
  { texto: "Prospectar não é o difícil." },
  { texto: "O difícil é manter a constância." },
  { texto: "Montar listas, encontrar o decisor, escrever, lembrar do follow-up, registrar quem respondeu." },
  { texto: "Na correria da semana, a prospecção é sempre a primeira a ficar para depois." },
  { texto: "Com a plataforma, ela acontece todos os dias.", destaque: true },
];

/**
 * Texto que acende palavra por palavra enquanto a seção atravessa a tela.
 * A opacidade de cada palavra é escrita direto no DOM (sem re-render) a
 * cada quadro de rolagem.
 */
export function Manifesto() {
  const secao = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = secao.current;
    if (!el) return;
    const palavras = Array.from(el.querySelectorAll<HTMLSpanElement>("[data-palavra]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      palavras.forEach((p) => (p.style.opacity = "1"));
      return;
    }
    let quadro = 0;
    const ultimos = palavras.map(() => -1);
    const atualizar = () => {
      quadro = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 quando o topo da seção encosta em 85% da tela; 1 quando o fim passa de 55%.
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
      const n = palavras.length;
      palavras.forEach((w, i) => {
        const local = Math.min(1, Math.max(0, p * (n + 6) - i));
        // Só escreve no DOM quando a palavra muda de fato.
        if (local === ultimos[i]) return;
        ultimos[i] = local;
        w.style.opacity = String(0.14 + local * 0.86);
      });
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    };
    // A rolagem só é acompanhada enquanto a seção está perto da tela.
    let ouvindo = false;
    const ligar = (sim: boolean) => {
      if (sim === ouvindo) return;
      ouvindo = sim;
      if (sim) {
        window.addEventListener("scroll", aoRolar, { passive: true });
        window.addEventListener("resize", aoRolar);
        aoRolar();
      } else {
        window.removeEventListener("scroll", aoRolar);
        window.removeEventListener("resize", aoRolar);
        // Garante o estado final certo (tudo apagado acima, tudo aceso abaixo).
        atualizar();
      }
    };
    const obs = new IntersectionObserver(([e]) => ligar(e.isIntersecting), { rootMargin: "25% 0px" });
    obs.observe(el);
    atualizar();
    return () => {
      obs.disconnect();
      ligar(false);
      cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <section ref={secao} className="relative mx-auto max-w-5xl px-4 py-28 sm:px-6 sm:py-40" aria-label="Por que a prospecção fica para depois">
      <p className="font-lp-display text-[30px] font-bold leading-[1.18] tracking-[-0.025em] sm:text-5xl sm:leading-[1.12]">
        {FRASES.map((f, fi) => (
          <span key={fi} className={f.destaque ? "font-lp-serif text-[1.1em] font-normal italic text-lp-glow" : undefined}>
            {f.texto.split(" ").map((w, wi) => (
              <span key={wi} data-palavra className="transition-opacity duration-150" style={{ opacity: 0.14 }}>
                {w}{" "}
              </span>
            ))}
            {fi < FRASES.length - 1 && " "}
          </span>
        ))}
      </p>
    </section>
  );
}
