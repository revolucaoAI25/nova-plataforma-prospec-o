"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function assinarMovimento(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/** true quando o visitante pediu menos animação no sistema. */
export function useMenosMovimento(): boolean {
  return useSyncExternalStore(
    assinarMovimento,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Marca o elemento como visto na primeira vez que entra na tela. */
export function useVisto<T extends Element>(margem = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisto(true);
          obs.disconnect();
        }
      },
      { rootMargin: margem },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margem]);
  return [ref, visto] as const;
}

/**
 * Linha do tempo de uma cena: quando `ativa`, avança de 0 até
 * `tempos.length` (cada número é quanto esperar, em ms, antes do passo
 * seguinte). Ao desativar, volta pro zero — a cena recomeça quando o
 * visitante volta pra ela. Com menos movimento, pula direto pro fim.
 */
export function useLinhaDoTempo(ativa: boolean, tempos: number[]): number {
  const menos = useMenosMovimento();
  const [passo, setPasso] = useState(0);
  const [ativaAntes, setAtivaAntes] = useState(ativa);
  if (ativa !== ativaAntes) {
    setAtivaAntes(ativa);
    if (!ativa) setPasso(0);
  }
  const chave = tempos.join(",");

  useEffect(() => {
    if (!ativa || menos) return;
    const lista = chave.split(",").map(Number);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let acumulado = 0;
    lista.forEach((t, i) => {
      acumulado += t;
      timers.push(setTimeout(() => setPasso(i + 1), acumulado));
    });
    return () => timers.forEach(clearTimeout);
  }, [ativa, menos, chave]);

  return menos && ativa ? tempos.length : passo;
}

/**
 * Conta até `ate` em `duracao` ms (easing de saída) quando `ligado`. Se o
 * alvo muda (calculadora), anima a partir do valor que está na tela.
 */
export function useContagem(ate: number, ligado: boolean, duracao = 1400, de = 0): number {
  const menos = useMenosMovimento();
  const [valor, setValor] = useState(de);
  const atual = useRef(de);
  useEffect(() => {
    if (!ligado || menos) return;
    let quadro = 0;
    const inicio = performance.now();
    const origem = atual.current;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 3);
      const v = origem + (ate - origem) * suave;
      atual.current = v;
      setValor(v);
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [ate, ligado, duracao, menos]);
  if (menos) return ligado ? ate : de;
  return valor;
}

/* Plano que a calculadora indicou — a seção de planos destaca ele. */
let planoSugerido: string | null = null;
const ouvintesPlano = new Set<() => void>();

export function definirPlanoSugerido(id: string | null) {
  if (id === planoSugerido) return;
  planoSugerido = id;
  ouvintesPlano.forEach((f) => f());
}

export function usePlanoSugerido(): string | null {
  return useSyncExternalStore(
    (cb) => {
      ouvintesPlano.add(cb);
      return () => ouvintesPlano.delete(cb);
    },
    () => planoSugerido,
    () => null,
  );
}
