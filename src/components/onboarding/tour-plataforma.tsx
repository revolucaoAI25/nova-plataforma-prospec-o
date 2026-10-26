"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PublicoTour = "teste" | "assinante";

interface Passo {
  /** Valor de data-tour do elemento destacado (item do menu, botão do topo); sem alvo, o cartão fica no centro. */
  alvo?: string;
  titulo: string;
  texto: string;
  /** Recurso liberado só no plano (mostrado no tour do teste grátis). */
  noPlano?: boolean;
  acoes?: { rotulo: string; href: string; principal?: boolean }[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Dois tours: o do teste grátis mostra o que já dá para usar e o que a
 * assinatura libera (para converter); o de quem assinou leva direto ao que
 * faz a prospecção começar: estratégia com a IA, canais conectados, funil.
 */
function passosDo(publico: PublicoTour, d: { nome: string | null; creditos: number; diasTeste: number | null; precoMinimo: number | null }): Passo[] {
  const ola = d.nome ? `, ${d.nome}` : "";
  if (publico === "teste") {
    return [
      {
        titulo: `Bem-vindo ao Leadmatic${ola}!`,
        texto: `Em menos de um minuto, mostramos onde fica cada coisa e o que já está liberado no seu teste grátis${d.diasTeste ? ` de ${d.diasTeste} dias` : ""}.`,
      },
      {
        alvo: "grupo:Busca",
        titulo: "Busca de empresas: liberada no teste",
        texto: `Encontre empresas do seu público pelo CNPJ (Receita Federal) ou no Google Maps, com nota, avaliações e telefone. Você tem ${d.creditos.toLocaleString("pt-BR")} créditos para testar.`,
      },
      { alvo: "/historico", titulo: "Histórico", texto: "Tudo o que você buscar fica salvo aqui, pronto para consultar e exportar." },
      {
        alvo: "/onboarding",
        noPlano: true,
        titulo: "Estratégia montada pela IA",
        texto: "Você responde algumas perguntas sobre o seu negócio e a IA monta o público, as mensagens e a cadência de cada canal. É o primeiro passo de quem assina.",
      },
      {
        alvo: "/enriquecimento",
        noPlano: true,
        titulo: "O contato de quem decide",
        texto: "A plataforma encontra o sócio de cada empresa, com celular e e-mail, para a abordagem chegar em quem assina o contrato, não na recepção.",
      },
      {
        alvo: "grupo:Disparo WhatsApp",
        noPlano: true,
        titulo: "Abordagem automática",
        texto: "Mensagens personalizadas por WhatsApp, e-mail e LinkedIn, com follow-up no dia certo e só em horário comercial.",
      },
      { alvo: "/funil", noPlano: true, titulo: "Funil de vendas", texto: "Quem responde entra no funil sozinho, na etapa certa. Você só assume a conversa." },
      {
        alvo: "/automacoes",
        noPlano: true,
        titulo: "Automações",
        texto: "Fluxos que buscam, enriquecem e abordam empresas novas todos os dias, sem você repetir o processo.",
      },
      {
        alvo: "assinar",
        titulo: "Para liberar tudo, é por aqui",
        texto: `Quando quiser a plataforma inteira, assine por este botão${d.precoMinimo ? `: planos a partir de ${brl(d.precoMinimo)}/mês` : ""}, com garantia de 7 dias e mensal sem fidelidade. Enquanto isso, que tal ver a qualidade dos contatos?`,
        acoes: [
          { rotulo: "Ver planos", href: "/creditos" },
          { rotulo: "Fazer minha primeira busca", href: "/busca/maps", principal: true },
        ],
      },
    ];
  }
  return [
    {
      titulo: `Tudo pronto${ola}!`,
      texto: "Vamos mostrar onde fica cada coisa. O primeiro passo é a estratégia: em poucos minutos, a IA monta a sua prospecção.",
    },
    {
      alvo: "/onboarding",
      titulo: "Comece por aqui: a estratégia",
      texto: "Responda as perguntas sobre o seu negócio. A IA monta três estratégias, com público, mensagens e cadência, e um guia mostra cada passo para ativar a escolhida.",
    },
    { alvo: "/conexoes", titulo: "Conecte os seus canais", texto: "WhatsApp (pelo QR Code), e-mail e LinkedIn. É por eles que a abordagem sai, em nome da sua empresa." },
    { alvo: "grupo:Busca", titulo: "Buscas", texto: "Para montar uma lista avulsa quando quiser: CNPJ, Google Maps, Instagram e LinkedIn." },
    { alvo: "/enriquecimento", titulo: "Enriquecimento", texto: "O sócio, o celular e o e-mail de quem decide em cada empresa, antes da abordagem." },
    {
      alvo: "grupo:Disparo WhatsApp",
      titulo: "Campanhas",
      texto: "Acompanhe envios, leituras e respostas de cada campanha. Os disparos por e-mail e LinkedIn ficam logo abaixo.",
    },
    { alvo: "/funil", titulo: "Funil", texto: "Quem responde cai aqui, na etapa certa. Mover um card pode disparar a próxima automação." },
    { alvo: "/automacoes", titulo: "Automações", texto: "A prospecção rodando todos os dias, sozinha: buscar, enriquecer e abordar empresas novas." },
    {
      alvo: "creditos",
      titulo: "Os seus créditos",
      texto: "Buscas e contatos do decisor usam créditos. Eles renovam todo mês com o plano e, se precisar de mais, dá para comprar pacotes avulsos.",
    },
    {
      titulo: "Bora começar?",
      texto: "A estratégia leva poucos minutos e, depois dela, um guia no canto da tela acompanha cada passo até a primeira campanha no ar. Você pode rever este tour pelo botão de ajuda no topo.",
      acoes: [
        { rotulo: "Explorar sozinho", href: "" },
        { rotulo: "Montar minha estratégia", href: "/onboarding", principal: true },
      ],
    },
  ];
}

/** O primeiro elemento visível com aquele data-tour (o menu existe no computador e no celular). */
function encontrarAlvo(alvo: string): HTMLElement | null {
  const lista = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(alvo)}"]`);
  for (const el of lista) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return el;
  }
  return null;
}

const LARGURA_CARTAO = 360;

export function TourPlataforma({
  publico, userId, visto, nome, creditos, diasTeste, precoMinimo,
}: {
  publico: PublicoTour;
  userId: string;
  /** O servidor já registrou que a pessoa viu (ou pulou) este tour. */
  visto: boolean;
  nome: string | null;
  creditos: number;
  diasTeste: number | null;
  precoMinimo: number | null;
}) {
  const chave = `lm_tour_${publico}_${userId}`;
  const passos = useMemo(() => passosDo(publico, { nome, creditos, diasTeste, precoMinimo }), [publico, nome, creditos, diasTeste, precoMinimo]);
  const [indice, setIndice] = useState<number | null>(null);
  // Posição do destaque, presa ao passo medido (passo sem alvo = cartão no centro).
  const [medida, setMedida] = useState<{ passo: number; rect: DOMRect } | null>(null);
  const rect = medida && medida.passo === indice ? medida.rect : null;
  const cartaoRef = useRef<HTMLDivElement>(null);
  const passo = indice !== null ? passos[indice] : null;

  const abrir = useCallback(() => setIndice(0), []);

  const fechar = useCallback(() => {
    setIndice(null);
    setMedida(null);
    try { localStorage.setItem(chave, "1"); } catch {}
    void fetch("/api/perfil/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publico }),
    }).catch(() => {});
    window.dispatchEvent(new Event("tour:fechado"));
  }, [chave, publico]);

  // Primeira entrada: abre sozinho. Depois, só pelo botão de ajuda.
  useEffect(() => {
    let jaViu = visto;
    try { jaViu = jaViu || localStorage.getItem(chave) === "1"; } catch {}
    const timer = jaViu ? null : setTimeout(abrir, 1200);
    window.addEventListener("tour:iniciar", abrir);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("tour:iniciar", abrir);
    };
  }, [abrir, chave, visto]);

  // Avisa o resto da tela (as ofertas do teste esperam o tour fechar).
  useEffect(() => {
    const raiz = document.documentElement;
    if (indice !== null) raiz.dataset.tour = "aberto";
    else delete raiz.dataset.tour;
    return () => { delete raiz.dataset.tour; };
  }, [indice]);

  // Posição do destaque: acompanha rolagem e redimensionamento.
  useLayoutEffect(() => {
    if (indice === null || !passo?.alvo) return;
    const alvo = encontrarAlvo(passo.alvo);
    if (!alvo) return;
    alvo.scrollIntoView({ block: "nearest" });
    const medir = () => setMedida({ passo: indice, rect: alvo.getBoundingClientRect() });
    const quadro = requestAnimationFrame(medir);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [indice, passo]);

  useEffect(() => {
    if (indice === null) return;
    cartaoRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      else if (e.key === "ArrowRight") setIndice((i) => (i !== null && i < passos.length - 1 ? i + 1 : i));
      else if (e.key === "ArrowLeft") setIndice((i) => (i !== null && i > 0 ? i - 1 : i));
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [indice, fechar, passos.length]);

  if (!passo || indice === null) return null;

  const ultimo = indice === passos.length - 1;
  const margem = 8;
  // Cartão ao lado do alvo (menu à esquerda) ou abaixo dele (topo); sem alvo, no centro.
  let estiloCartao: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (rect && typeof window !== "undefined") {
    const cabeAoLado = rect.right + 16 + LARGURA_CARTAO < window.innerWidth;
    if (cabeAoLado) {
      const topo = Math.min(Math.max(16, rect.top + rect.height / 2 - 110), window.innerHeight - 300);
      estiloCartao = { left: rect.right + 16, top: topo };
    } else {
      const esquerda = Math.min(Math.max(16, rect.left + rect.width / 2 - LARGURA_CARTAO / 2), window.innerWidth - LARGURA_CARTAO - 16);
      estiloCartao = { left: esquerda, top: rect.bottom + 14 };
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-titulo">
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{
            left: rect.left - margem,
            top: rect.top - margem,
            width: rect.width + margem * 2,
            height: rect.height + margem * 2,
            boxShadow: "0 0 0 9999px rgba(3, 8, 6, 0.62)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgba(3,8,6,0.62)]" />
      )}

      <div
        ref={cartaoRef}
        tabIndex={-1}
        className="fixed flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-5 shadow-[var(--elevation-lg)] outline-none"
        style={estiloCartao}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            {passo.noPlano ? (
              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Lock className="h-3 w-3" /> Liberado ao assinar
              </span>
            ) : indice === 0 ? (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                <Sparkles className="h-3 w-3" /> Tour da plataforma
              </span>
            ) : null}
            <h2 id="tour-titulo" className="text-base font-semibold leading-snug text-foreground">{passo.titulo}</h2>
          </div>
          <button type="button" onClick={fechar} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fechar o tour">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{passo.texto}</p>

        {passo.acoes ? (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {passo.acoes.map((a) =>
              a.href ? (
                <Button key={a.rotulo} asChild size="sm" variant={a.principal ? "default" : "outline"}>
                  <Link href={a.href} onClick={fechar}>
                    {a.rotulo} {a.principal && <ArrowRight />}
                  </Link>
                </Button>
              ) : (
                <Button key={a.rotulo} size="sm" variant="outline" onClick={fechar}>{a.rotulo}</Button>
              ),
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{indice + 1} de {passos.length}</span>
            <div className="flex justify-end gap-2">
              {indice > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => setIndice(indice - 1)}>
                  <ArrowLeft /> Voltar
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={fechar}>Pular</Button>
              )}
              <Button size="sm" onClick={() => (ultimo ? fechar() : setIndice(indice + 1))}>
                {ultimo ? "Concluir" : "Próximo"} {!ultimo && <ArrowRight />}
              </Button>
            </div>
          </div>
        )}
        <div className="flex gap-1" aria-hidden>
          {passos.map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i <= indice ? "bg-primary" : "bg-secondary")} />
          ))}
        </div>
      </div>
    </div>
  );
}
