"use client";

import { useEffect } from "react";
import { capturarOrigem, eventoPixel, iniciarPixel, registrarEvento } from "@/lib/rastreamento/cliente";

/** De onde é cada clique: o destino do link diz a intenção (assinar, testar, WhatsApp…). */
function alvoDoClique(el: HTMLElement): string | null {
  const marcado = el.closest<HTMLElement>("[data-rastreio]")?.dataset.rastreio;
  const secao = el.closest<HTMLElement>("[data-secao]")?.dataset.secao ?? "topo";
  if (marcado) return `${marcado}:${secao}`.slice(0, 80);
  const href = el.closest("a")?.getAttribute("href") ?? "";
  let base: string | null = null;
  if (href.includes("/assinar")) base = "assinar";
  else if (href.includes("/teste-gratis")) base = "teste";
  else if (/wa\.me|whatsapp\.com/.test(href)) base = "whatsapp";
  else if (href.startsWith("#")) base = `ancora${href.replace("#", "_")}`;
  else if (href.includes("/login")) base = "entrar";
  if (!base) return null;
  return `${base}:${secao}`.slice(0, 80);
}

/**
 * Rastreamento das páginas públicas (vendas, contratação, teste grátis e
 * boas-vindas): Pixel da Meta e o nosso funil. Na página de vendas,
 * também registra até onde a pessoa rolou (seções com data-secao) e em quais
 * botões ela clicou.
 */
export function RastreamentoLP({
  pixelId, pagina, aoAbrir, correspondencia,
}: {
  pixelId?: string | null;
  pagina: "vendas" | "assinar" | "teste" | "bem-vindo";
  /** Evento do Pixel próprio desta página (ex.: InitiateCheckout com o valor do plano). */
  aoAbrir?: { nome: string; params?: Record<string, unknown> } | null;
  /** Correspondência avançada do Pixel, para quem já está logado (e-mail, telefone). */
  correspondencia?: Record<string, string>;
}) {
  useEffect(() => {
    capturarOrigem();
    if (pixelId) {
      iniciarPixel(pixelId, correspondencia);
      eventoPixel("PageView");
      if (pagina === "vendas") eventoPixel("ViewContent", { content_name: "Página de vendas" });
      if (aoAbrir) eventoPixel(aoAbrir.nome, aoAbrir.params);
    }
    registrarEvento("pagina_vista");
    // Uma vez por abertura de página; os parâmetros não mudam depois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pagina !== "vendas") return;
    const vistas = new Set<string>();
    const aoVer = (entradas: IntersectionObserverEntry[]) => {
      for (const e of entradas) {
        const nome = (e.target as HTMLElement).dataset.secao;
        if (!e.isIntersecting || !nome || vistas.has(nome)) continue;
        vistas.add(nome);
        registrarEvento("secao_vista", nome);
        if (nome === "planos") eventoPixel("VerPlanos");
      }
    };
    // Vista = entrou nos 60% de cima da tela (seções mais altas que a tela)
    // ou está 60% visível (seções curtas do fim, como o rodapé, que não sobem tanto).
    const observadores = [
      new IntersectionObserver(aoVer, { threshold: 0, rootMargin: "0px 0px -40% 0px" }),
      new IntersectionObserver(aoVer, { threshold: 0.6 }),
    ];
    document.querySelectorAll<HTMLElement>("[data-secao]").forEach((el) => observadores.forEach((o) => o.observe(el)));
    return () => observadores.forEach((o) => o.disconnect());
  }, [pagina]);

  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("a, button");
      if (!el) return;
      const alvo = alvoDoClique(el);
      if (!alvo) return;
      registrarEvento("clique", alvo);
      if (alvo.startsWith("whatsapp")) eventoPixel("Contact");
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);

  return null;
}
