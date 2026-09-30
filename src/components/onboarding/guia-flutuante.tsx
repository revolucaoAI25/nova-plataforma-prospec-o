"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Compass, MapPin, Minus, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PassoChecklist } from "@/lib/onboarding/aplicar";

interface Guia {
  letra: string;
  titulo: string;
  passos: PassoChecklist[];
}

const CHAVE_MINIMIZADO = "guia-onboarding-minimizado";

async function buscarGuia(): Promise<Guia | null> {
  const resp = await fetch("/api/onboarding/guia", { cache: "no-store" }).catch(() => null);
  if (!resp?.ok) return null;
  const data = await resp.json().catch(() => ({}));
  return data.guia ?? null;
}

function caminhoDe(href: string): string {
  return href.split("#")[0].split("?")[0];
}

/**
 * Cartão fixo no canto da tela enquanto houver uma sugestão em configuração:
 * mostra o próximo passo, leva até a tela certa e, quando o cliente já está
 * nela, destaca o elemento marcado com data-guia="<id do passo>".
 */
export function GuiaFlutuante() {
  const pathname = usePathname();
  const [guia, setGuia] = useState<Guia | null>(null);
  // Só importa depois que o guia carrega (antes disso nada é renderizado),
  // então ler o localStorage no inicializador não causa divergência de hidratação.
  const [minimizado, setMinimizado] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const salvo = localStorage.getItem(CHAVE_MINIMIZADO);
      // No celular o cartão aberto cobre boa parte da tela: começa recolhido.
      return salvo === null ? window.matchMedia("(max-width: 639px)").matches : salvo === "1";
    } catch { return false; }
  });

  useEffect(() => {
    let ativo = true;
    const carregar = () => void buscarGuia().then((g) => ativo && setGuia(g));
    carregar();
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [pathname]);

  const obrigatorios = guia?.passos.filter((p) => p.obrigatorio) ?? [];
  const feitos = obrigatorios.filter((p) => p.feito).length;
  const atual = guia?.passos.find((p) => p.obrigatorio && !p.feito) ?? null;
  const naTela = atual ? caminhoDe(atual.href) === pathname : false;

  useEffect(() => {
    if (!atual || !naTela || minimizado) return;
    // O alvo pode ainda não ter montado (painéis que carregam dados no
    // cliente): tenta por alguns segundos antes de desistir.
    let alvo: HTMLElement | null = null;
    let tentativas = 0;
    const procurar = () => {
      alvo = document.querySelector<HTMLElement>(`[data-guia="${atual.id}"]`);
      if (alvo) {
        alvo.classList.add("guia-destaque");
        alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (++tentativas < 15) {
        timer = setTimeout(procurar, 300);
      }
    };
    let timer = setTimeout(procurar, 0);
    return () => {
      clearTimeout(timer);
      alvo?.classList.remove("guia-destaque");
    };
  }, [atual, naTela, minimizado]);

  // Reserva espaço no fim da página enquanto o guia está visível, pra ele
  // nunca cobrir de vez os botões do rodapé dos formulários.
  const cartaoRef = useRef<HTMLElement>(null);
  const visivel = Boolean(guia) && pathname !== "/onboarding";
  useEffect(() => {
    const raiz = document.documentElement;
    const el = cartaoRef.current;
    if (!visivel || !el) {
      raiz.style.removeProperty("--guia-espaco");
      return;
    }
    const medir = () => raiz.style.setProperty("--guia-espaco", `${el.offsetHeight + 32}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--guia-espaco");
    };
  }, [visivel, minimizado]);

  function alternarMinimizado(valor: boolean) {
    setMinimizado(valor);
    try { localStorage.setItem(CHAVE_MINIMIZADO, valor ? "1" : "0"); } catch {}
  }

  if (!guia || pathname === "/onboarding") return null;

  if (minimizado) {
    return (
      <button
        ref={cartaoRef as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={() => alternarMinimizado(false)}
        className="fixed bottom-5 right-5 z-40 flex cursor-pointer items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-[var(--elevation-lg)] hover:border-primary"
        aria-label="Abrir guia de configuração"
      >
        <Compass className="h-4 w-4 text-primary" /> Sugestão {guia.letra}: {feitos}/{obrigatorios.length}
      </button>
    );
  }

  return (
    <aside
      ref={cartaoRef}
      aria-label="Guia de configuração da sugestão"
      className="fixed bottom-5 right-5 z-40 flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4 shadow-[var(--elevation-lg)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"><Compass className="h-3.5 w-3.5" /> Configurando a Sugestão {guia.letra}</p>
          <p className="truncate text-xs text-muted-foreground">{guia.titulo}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => alternarMinimizado(true)} aria-label="Minimizar guia">
          <Minus className="h-4 w-4" />
        </Button>
      </div>
      <Progress value={obrigatorios.length ? (feitos / obrigatorios.length) * 100 : 100} />

      {atual ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">
            Passo {feitos + 1} de {obrigatorios.length}: {atual.titulo}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">{atual.descricao}</p>
          {naTela ? (
            <p className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground">
              <MapPin className="h-3.5 w-3.5" /> É aqui mesmo — destacamos onde fazer isso nesta tela.
            </p>
          ) : (
            <Button asChild size="sm" className="self-start">
              <Link href={atual.href}>{atual.acao} <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><PartyPopper className="h-4 w-4 text-primary" /> Tudo pronto!</p>
          <p className="text-xs text-muted-foreground">Os passos obrigatórios estão concluídos. Volte à sugestão, revise as mensagens se quiser e dê play.</p>
          <Button asChild size="sm" className="self-start">
            <Link href="/onboarding">Dar play <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      )}
      {atual && (
        <Link href="/onboarding" className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">Ver a sugestão completa</Link>
      )}
    </aside>
  );
}
