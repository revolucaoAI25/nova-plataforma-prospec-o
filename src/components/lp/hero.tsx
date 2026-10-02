"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "./dados";
import { useMenosMovimento } from "./hooks";

const LEADS: [string, 1 | 2 | 3 | 4 | 5, number][] = [
  ["Sorriso Pleno", 2, -46], ["Grupo Vértice", 1, 38], ["Contábil Horizonte", 3, -14], ["Studio Forma", 1, 58],
  ["Lima & Rocha Adv.", 5, 6], ["TecFrio Climatização", 2, -62], ["Ótica Visão Clara", 1, 24], ["Construtora Alicerce", 4, -30],
  ["Pet Shop Patas", 2, 48], ["Escola Saber Mais", 3, -54], ["Imobiliária Lar", 1, 12], ["Auto Center Prime", 5, -8],
  ["Agência Pulso", 2, 34], ["Distribuidora Norte", 1, -40], ["Clínica Bem Estar", 3, 52], ["Padaria Trigo Bom", 4, -22],
];

const ESTACOES = [
  { pos: 4, rotulo: "Empresas encontradas", curto: "Empresas", base: 2410, ritmo: 2.4 },
  { pos: 26, rotulo: "Decisores identificados", curto: "Decisores", base: 1930, ritmo: 1.9 },
  { pos: 48, rotulo: "Abordagens enviadas", curto: "Abordadas", base: 1620, ritmo: 1.6 },
  { pos: 70, rotulo: "Respostas", curto: "Respostas", base: 194, ritmo: 0.19 },
  { pos: 92, rotulo: "Reuniões marcadas", curto: "Reuniões", base: 58, ritmo: 0.06 },
];

const LETREIRO = [
  "CNPJ da Receita Federal", "Google Maps", "Instagram", "LinkedIn", "WhatsApp por QR Code", "API oficial do WhatsApp",
  "E-mail com domínio próprio", "Funil Kanban", "Teste A/B", "Google Sheets", "Fluxos automáticos", "Status de leitura",
];

function FluxoAoVivo() {
  const menos = useMenosMovimento();
  const [tique, setTique] = useState(0);
  useEffect(() => {
    if (menos) return;
    const id = setInterval(() => setTique((t) => t + 1), 900);
    return () => clearInterval(id);
  }, [menos]);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-lp-line bg-lp-surface/70 shadow-[0_40px_120px_-40px_rgba(0,200,83,0.35)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lp-line px-4 py-3 font-lp-mono text-[11px] uppercase tracking-[0.14em] text-lp-muted-2 sm:px-6">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lp-accent opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lp-accent" />
          </span>
          Campanha em andamento · simulação
        </span>
        <span className="hidden sm:inline">seg a sex · 8h às 19h · 80 novos contatos/dia</span>
      </div>

      <div className="lp-trilho mx-2 sm:mx-6" aria-hidden="true">
        <div className="lp-trilho-linha" />
        {LEADS.map(([nome, fim, y], i) => (
          <div
            key={nome}
            className="lp-lead"
            data-fim={fim}
            style={{ animationDelay: `${-i * 0.6}s`, ["--y" as string]: `${y}px` }}
          >
            <span className="lp-lead-pilula flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.06] px-1.5 py-1.5 font-lp-mono text-[11px] text-[#c9d2cd] sm:px-2.5 sm:py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              <span className="hidden sm:inline">{nome}</span>
            </span>
          </div>
        ))}
        {ESTACOES.map((e, i) => (
          <div key={e.rotulo} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${e.pos}%` }}>
            <span
              className={cn(
                "block h-3.5 w-3.5 rounded-full border-2",
                i === ESTACOES.length - 1 ? "lp-estacao-pulso border-lp-glow bg-lp-accent" : "border-lp-accent/70 bg-lp-bg",
              )}
            />
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-5 border-t border-lp-line">
        {ESTACOES.map((e, i) => {
          const valor = e.base + Math.floor(tique * e.ritmo);
          const ultimo = i === ESTACOES.length - 1;
          return (
            <div key={e.rotulo} className={cn("flex flex-col gap-1 px-2 py-3 sm:px-5 sm:py-4", i > 0 && "border-l border-lp-line")}>
              <dt className="font-lp-mono text-[9.5px] uppercase leading-tight tracking-[0.1em] text-lp-muted-2 sm:text-[11px] sm:tracking-[0.14em]">
                <span className="sm:hidden">{e.curto}</span>
                <span className="hidden sm:inline">{e.rotulo}</span>
              </dt>
              <dd className={cn("lp-numero font-lp-display text-lg font-bold tracking-tight sm:text-3xl", ultimo ? "text-lp-glow" : "text-lp-text")}>
                {num(valor)}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-28 sm:pt-36">
      <div className="lp-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div className="lp-aurora -z-10 left-[10%] top-[-140px] h-[520px] w-[520px]" aria-hidden="true" />
      <div className="lp-aurora -z-10 right-[-120px] top-[260px] h-[420px] w-[420px] [animation-delay:-7s]" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="lp-entra mx-auto inline-flex items-center gap-2 rounded-full border border-lp-line-2 bg-white/[0.03] px-3.5 py-1.5 font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-lp-accent" />
            Leads qualificados, sem depender de tráfego pago
          </p>
          <h1 className="lp-entra mt-7 font-lp-display text-[40px] font-extrabold leading-[0.98] tracking-[-0.035em] text-balance sm:text-6xl lg:text-[76px] [animation-delay:80ms]">
            Reuniões qualificadas na sua agenda, toda semana.{" "}
            <span className="block font-lp-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-lp-glow">
              Sem prospecção manual.
            </span>
          </h1>
          <p className="lp-entra mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-lp-muted sm:text-lg [animation-delay:160ms]">
            A plataforma encontra leads qualificados com o perfil do seu cliente ideal, identifica e enriquece o contato de quem decide,
            conduz a abordagem com uma sequência de mensagens e avisa quando alguém responde. Você entra na conversa quando ela já está aquecida.
          </p>
          <div className="lp-entra mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row [animation-delay:240ms]">
            <a
              href="#planos"
              className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-lp-accent px-7 text-[15px] font-semibold text-[#04140a] shadow-[0_0_0_1px_rgba(93,255,160,0.4),0_18px_50px_-12px_rgba(0,200,83,0.65)] transition-[background-color,transform] hover:bg-lp-glow active:scale-[0.98] sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow"
            >
              Começar agora
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#conta"
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border border-lp-line-2 px-7 text-[15px] font-medium text-lp-text transition-colors hover:border-lp-accent/60 hover:bg-white/[0.03] sm:w-auto"
            >
              Simular meu resultado
              <ArrowDown className="h-4 w-4" />
            </a>
          </div>
          <p className="lp-entra mt-5 text-[13px] text-lp-muted-2 [animation-delay:300ms]">
            Plano mensal sem fidelidade · Acesso liberado após o pagamento · Primeira estratégia criada por IA
          </p>
        </div>

        <div className="lp-entra mx-auto mt-16 max-w-6xl sm:mt-20 [animation-delay:380ms]">
          <FluxoAoVivo />
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-lp-muted-2">
            Cada ponto representa uma empresa. A maior parte fica pelo caminho, como em qualquer funil.
            O resultado está no que chega ao final.
          </p>
        </div>
      </div>

      <div className="lp-letreiro mt-16 border-y border-lp-line py-5 sm:mt-20" aria-label="Fontes e canais da plataforma">
        <div className="lp-letreiro-faixa">
          {[...LETREIRO, ...LETREIRO].map((item, i) => (
            <span key={i} aria-hidden={i >= LETREIRO.length} className="flex items-center gap-6 pr-6 font-lp-mono text-[13px] uppercase tracking-[0.14em] text-lp-muted">
              {item}
              <span className="text-lp-accent">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
