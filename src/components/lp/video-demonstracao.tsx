"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { registrarEvento } from "@/lib/rastreamento/cliente";

/**
 * Vídeo da plataforma funcionando, logo abaixo do topo. Até o clique só a
 * capa carrega (o vídeo não pesa no carregamento da página); o clique troca
 * a capa pelo player, já tocando com som.
 */
export function VideoDemonstracao() {
  const [tocando, setTocando] = useState(false);

  function tocar() {
    setTocando(true);
    registrarEvento("clique", "video:demonstracao");
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="relative aspect-video overflow-hidden rounded-[24px] border border-lp-line-2 bg-[#f3f6f4] shadow-[0_40px_120px_-40px_rgba(0,200,83,0.45)] sm:rounded-[28px]">
        {tocando ? (
          // WebM (menor) primeiro; MP4 para quem não toca WebM.
          <video className="h-full w-full" poster="/lp/demonstracao-capa.webp" controls autoPlay playsInline preload="auto">
            <source src="/lp/demonstracao.webm" type='video/webm; codecs="vp9, opus"' />
            <source src="/lp/demonstracao.mp4" type="video/mp4" />
          </video>
        ) : (
          <button type="button" onClick={tocar} className="group absolute inset-0 h-full w-full focus-visible:outline-none" aria-label="Assistir ao vídeo da plataforma funcionando (1 minuto e 18 segundos)">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lp/demonstracao-capa.webp" alt="" width={1280} height={720} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" aria-hidden="true" />
            <span className="absolute bottom-[7%] left-1/2 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-lp-accent py-2 pl-2 pr-4 text-sm font-semibold text-[#04140a] shadow-[0_18px_50px_-12px_rgba(0,200,83,0.75)] transition-transform group-hover:scale-[1.04] group-focus-visible:ring-4 group-focus-visible:ring-lp-glow/50 sm:bottom-auto sm:top-[62%] sm:-translate-y-1/2 sm:gap-3 sm:py-3.5 sm:pl-3 sm:pr-6 sm:text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#04140a] text-lp-glow sm:h-10 sm:w-10">
                <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
              </span>
              <span className="sm:hidden">Assistir · 1:18</span>
              <span className="hidden sm:inline">Ver a plataforma funcionando · 1:18</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
