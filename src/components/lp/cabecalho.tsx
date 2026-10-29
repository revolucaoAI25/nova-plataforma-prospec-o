"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  ["#como-funciona", "Como funciona"],
  ["#conta", "Simulação"],
  ["#comparativo", "Comparativo"],
  ["#planos", "Planos"],
  ["#duvidas", "Dúvidas"],
] as const;

export function Cabecalho() {
  const barra = useRef<HTMLDivElement>(null);
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    let quadro = 0;
    const atualizar = () => {
      quadro = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (barra.current) barra.current.style.transform = `scaleX(${p})`;
      setRolou(window.scrollY > 24);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    };
    atualizar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        rolou ? "border-b border-lp-line bg-lp-bg/75 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/conheca" prefetch={false} className="flex items-center gap-2.5" aria-label="Leadmatic, início">
          <Image src="/logo.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full" priority />
          <span className="leading-none">
            <span className="block whitespace-nowrap font-lp-display text-[15px] font-bold tracking-tight">Leadmatic</span>
            <span className="mt-0.5 block whitespace-nowrap font-lp-mono text-[10px] uppercase tracking-[0.18em] text-lp-muted-2">por Revolução AI</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 whitespace-nowrap text-sm text-lp-muted lg:flex" aria-label="Seções">
          {LINKS.map(([href, rotulo]) => (
            <a key={href} href={href} className="transition-colors hover:text-lp-text">{rotulo}</a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Sempre visível: quem já é cliente chega aqui pelo anúncio ou pelo domínio e precisa achar o login. */}
          <Link
            href="/login"
            prefetch={false}
            className="flex min-h-10 items-center rounded-full px-2.5 text-sm font-medium text-lp-muted transition-colors hover:text-lp-text sm:px-3"
          >
            Entrar
          </Link>
          <a
            href="#planos"
            className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-lp-accent px-4 py-2 text-sm font-semibold text-[#04140a] transition-[background-color,box-shadow] hover:bg-lp-glow hover:shadow-[0_0_24px_rgba(0,200,83,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-glow"
          >
            {/* No celular o rótulo encurta para caber junto com o Entrar numa linha. */}
            <span>Começar<span className="hidden sm:inline"> agora</span></span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
      <div ref={barra} className="h-px origin-left scale-x-0 bg-gradient-to-r from-lp-accent to-lp-glow" aria-hidden="true" />
    </header>
  );
}
