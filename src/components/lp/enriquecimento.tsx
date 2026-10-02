"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Briefcase, Building2, Globe, Loader2, Mail, MessageSquareText, Phone, Sparkles, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLinhaDoTempo } from "./hooks";
import { Janela, Selo } from "./janela";
import { Revela } from "./revela";

const CAMADAS = [
  { passo: 2, icone: Users, titulo: "Quadro societário", texto: "Sócios e administradores de cada empresa, para chegar a quem assina o contrato." },
  { passo: 3, icone: Phone, titulo: "Contato direto do decisor", texto: "Celular e e-mail de quem decide, além do telefone geral da empresa." },
  { passo: 4, icone: Star, titulo: "Validação no Google Maps", texto: "Telefone, site, nota e número de avaliações conferidos no perfil público." },
  { passo: 5, icone: Sparkles, titulo: "Pesquisa com IA na internet", texto: "Site, LinkedIn, cargo e um resumo do negócio, com nível de confiança." },
  { passo: 6, icone: MessageSquareText, titulo: "Perguntas personalizadas", texto: "A IA responde o que importa para a sua venda, como “a empresa já anuncia no Google?”." },
];

function Linha({ icone: Icone, rotulo, valor, fonte }: { icone: typeof Phone; rotulo: string; valor: string; fonte: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-lp-line bg-lp-bg/50 px-3 py-2">
      <Icone className="h-4 w-4 shrink-0 text-lp-accent" />
      <span className="w-24 shrink-0 text-[11.5px] text-lp-muted-2 sm:w-28">{rotulo}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-lp-text">{valor}</span>
      <span className="hidden shrink-0 font-lp-mono text-[9.5px] uppercase tracking-[0.1em] text-lp-muted-2 sm:block">{fonte}</span>
    </div>
  );
}

/**
 * Mostra um lead "cru" (só CNPJ e telefone da recepção) ganhando, camada a
 * camada, o que o enriquecimento entrega. Recomeça quando volta à tela.
 */
export function Enriquecimento() {
  const ref = useRef<HTMLDivElement>(null);
  const [naTela, setNaTela] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setNaTela(e.isIntersecting), { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const p = useLinhaDoTempo(naTela, [700, 1100, 900, 900, 900, 1100, 1000, 700]);

  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div ref={ref} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Revela>
            <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Enriquecimento com IA</p>
            <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-5xl">
              Do CNPJ ao decisor,{" "}
              <span className="font-lp-serif font-normal italic text-lp-glow">em poucos segundos.</span>
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-lp-muted">
              Uma lista de empresas é só o começo. A plataforma completa cada lead com quem decide, como falar com essa pessoa e o
              contexto necessário para uma abordagem personalizada. É isso que transforma um contato frio em uma conversa relevante.
            </p>
            <ol className="mt-8 flex flex-col gap-2">
              {CAMADAS.map((c) => {
                const ativa = p >= c.passo;
                return (
                  <li
                    key={c.titulo}
                    className={cn(
                      "flex gap-3 rounded-2xl border px-4 py-3 transition-colors duration-500",
                      p === c.passo ? "border-lp-accent/50 bg-lp-accent-soft" : "border-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-500",
                        ativa ? "border-lp-accent/50 bg-lp-accent-soft text-lp-glow" : "border-lp-line-2 text-lp-muted-2",
                      )}
                    >
                      <c.icone className="h-4 w-4" />
                    </span>
                    <span>
                      <span className={cn("block text-[15px] font-semibold transition-colors", ativa ? "text-lp-text" : "text-lp-muted")}>{c.titulo}</span>
                      <span className="block text-[13.5px] leading-relaxed text-lp-muted">{c.texto}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Revela>

          <div className="h-[680px] sm:h-[600px]">
            <Janela
              caminho="prospeccao-ativa / enriquecimento / sorriso-pleno"
              status={p >= 7 ? <span className="text-lp-glow">lead qualificado</span> : p >= 1 ? "enriquecendo" : "lead original"}
            >
              <div className="flex h-full flex-col gap-2.5">
                <div className="flex items-center gap-3 rounded-xl border border-lp-line bg-white/[0.02] px-3.5 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-lp-muted"><Building2 className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-lp-text">Sorriso Pleno Odontologia LTDA</p>
                    <p className="truncate font-lp-mono text-[11px] text-lp-muted-2">CNPJ 12.•••.•••/0001-•• · Belo Horizonte</p>
                  </div>
                  {p < 2 && <Selo>antes</Selo>}
                </div>
                {p < 2 && (
                  <Linha icone={Phone} rotulo="Telefone" valor="(31) 3•••-••10 · recepção" fonte="Receita Federal" />
                )}
                {p === 1 && (
                  <div className="lp-entra lp-varredura flex items-center gap-2 rounded-xl border border-lp-line bg-white/[0.02] px-3 py-2.5 text-[13px] text-lp-muted">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lp-accent motion-reduce:animate-none" /> Cruzando Receita Federal, Google Maps, bases de dados e pesquisa com IA…
                  </div>
                )}
                {p >= 2 && (
                  <div className="lp-entra-lado flex flex-col gap-1.5">
                    <Linha icone={Users} rotulo="Sócia-administradora" valor="Mariana Costa" fonte="Quadro societário" />
                    <Linha icone={Users} rotulo="Sócio" valor="Rafael Costa" fonte="Quadro societário" />
                  </div>
                )}
                {p >= 3 && (
                  <div className="lp-entra-lado flex flex-col gap-1.5">
                    <Linha icone={Phone} rotulo="Celular" valor="(31) 9 8•••-••42 · Mariana" fonte="Enriquecimento" />
                    <Linha icone={Mail} rotulo="E-mail" valor="mariana@sorrisopleno.com.br" fonte="Enriquecimento" />
                  </div>
                )}
                {p >= 4 && (
                  <div className="lp-entra-lado">
                    <Linha icone={Star} rotulo="Google" valor="4,8 · 212 avaliações · site validado" fonte="Google Maps" />
                  </div>
                )}
                {p >= 5 && (
                  <div className="lp-entra-lado rounded-xl border border-lp-accent/30 bg-lp-accent-soft/40 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-lp-glow"><Sparkles className="h-3.5 w-3.5" /> Pesquisa com IA</span>
                      <span className="flex items-center gap-2 text-lp-muted-2"><Globe className="h-3.5 w-3.5" /><Briefcase className="h-3.5 w-3.5" /></span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-lp-text/90">
                      Clínica com três dentistas, foco em implantes e estética. Atende particular e convênios. Mariana é a responsável
                      pela gestão e pelo marketing.
                    </p>
                  </div>
                )}
                {p >= 6 && (
                  <div className="lp-entra-lado grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {[
                      ["Já anuncia no Google?", "Não encontrado"],
                      ["Tem agendamento online?", "Não"],
                    ].map(([pergunta, resposta]) => (
                      <div key={pergunta} className="rounded-xl border border-lp-line bg-lp-bg/50 px-3 py-2">
                        <p className="text-[11px] text-lp-muted-2">{pergunta}</p>
                        <p className="text-[13px] font-semibold text-lp-text">{resposta}</p>
                      </div>
                    ))}
                  </div>
                )}
                {p >= 7 && (
                  <div className="lp-entra mt-auto flex items-center gap-2.5 rounded-xl border border-lp-accent/50 bg-lp-accent-soft px-3.5 py-3 shadow-[0_0_40px_-12px_rgba(0,200,83,0.7)]">
                    <BadgeCheck className="h-5 w-5 shrink-0 text-lp-glow" />
                    <span className="text-sm font-semibold text-lp-glow">Lead qualificado, com decisor e contexto para a abordagem.</span>
                  </div>
                )}
              </div>
            </Janela>
          </div>
        </div>
      </div>
    </section>
  );
}
