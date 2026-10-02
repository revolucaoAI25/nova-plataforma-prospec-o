"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { CenaBusca, CenaDecisor, CenaEstrategia } from "./cenas-inicio";
import { CenaCadencia, CenaFunil, CenaResultado } from "./cenas-fim";

interface Ato {
  rotulo: string;
  titulo: string;
  texto: string;
  detalhes: string[];
  Cena: ComponentType<{ ativa: boolean }>;
}

const ATOS: Ato[] = [
  {
    rotulo: "Você conta como vende",
    titulo: "Você responde umas perguntas. A IA monta o plano.",
    texto:
      "O que você vende, pra quem, quanto custa, quem decide a compra e quantas conversas o seu time dá conta de atender. Com isso ela desenha estratégias prontas: de onde tirar os leads, por qual canal falar, quantos por dia e o que escrever.",
    detalhes: ["Você escolhe uma e ajusta o que quiser", "O volume já vem calculado pelos seus créditos"],
    Cena: CenaEstrategia,
  },
  {
    rotulo: "Ela acha quem compra",
    titulo: "Milhares de empresas com cara de cliente seu.",
    texto:
      "Base de CNPJ da Receita com filtro por atividade, cidade, porte e idade da empresa. Google Maps pra negócio local, com nota e avaliações. Instagram e LinkedIn quando o seu cliente vive lá. Quem você já abordou não volta pra lista.",
    detalhes: ["Busca na hora ou agendada todo dia", "Sem lead repetido entre campanhas"],
    Cena: CenaBusca,
  },
  {
    rotulo: "E descobre quem decide",
    titulo: "Nada de falar com a recepção.",
    texto:
      "Sócios, celular, e-mail, site e nota no Google. A plataforma cruza as fontes pra você chegar em quem assina o contrato, e não no famoso “manda um e-mail pro comercial”.",
    detalhes: ["Telefone e site conferidos no Google Maps", "Contato do decisor por enriquecimento"],
    Cena: CenaDecisor,
  },
  {
    rotulo: "A mensagem sai. E a próxima também.",
    titulo: "Follow-up é onde a venda acontece. E é o que todo mundo esquece.",
    texto:
      "Cadência com várias mensagens no WhatsApp, no e-mail e no LinkedIn, com intervalo entre elas, só em horário comercial e num ritmo que não queima o seu número. Cada mensagem fala o nome da pessoa, o nome da empresa e por que você está ali.",
    detalhes: ["Teste A/B pra ver qual versão responde mais", "Entregue, lida e respondida, mensagem por mensagem"],
    Cena: CenaCadencia,
  },
  {
    rotulo: "Quem responde vira oportunidade",
    titulo: "Respondeu? Já está no seu funil.",
    texto:
      "A cadência para pra quem respondeu, o card vai pra coluna certa e você assume a conversa. Mover um card pode disparar a próxima automação: lembrete de reunião, proposta, o que fizer sentido no seu processo.",
    detalhes: ["Funil em Kanban, do jeito que você vende", "Automação disparada pela etapa do card"],
    Cena: CenaFunil,
  },
  {
    rotulo: "Você aparece pra fechar",
    titulo: "No fim do mês, a conta é simples.",
    texto:
      "Quantas empresas foram abordadas, quantas responderam, quantas viraram reunião e quantas fecharam. Dá pra ver onde o funil vaza e mexer na mensagem, no público ou no ritmo, em vez de chutar.",
    detalhes: ["Relatório por campanha e por canal", "Exemplo com taxas médias de prospecção B2B"],
    Cena: CenaResultado,
  },
];

function assinarLargura(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function useDesktop() {
  return useSyncExternalStore(assinarLargura, () => window.matchMedia("(min-width: 1024px)").matches, () => false);
}

export function Historia() {
  const desktop = useDesktop();
  const [ativo, setAtivo] = useState(0);
  const blocos = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setAtivo(Number((e.target as HTMLElement).dataset.ato));
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    blocos.current.forEach((b) => b && obs.observe(b));
    return () => obs.disconnect();
  }, [desktop]);

  function irPara(i: number) {
    blocos.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section id="como-funciona" className="relative scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Como o resultado é construído</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            Do zero à reunião marcada, em{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">seis movimentos.</span>
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:mt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            {ATOS.map((a, i) => (
              <div
                key={a.rotulo}
                ref={(el) => {
                  blocos.current[i] = el;
                }}
                data-ato={i}
                className={cn(
                  "flex flex-col justify-center py-10 transition-opacity duration-500 lg:min-h-[86vh] lg:py-0",
                  desktop && ativo !== i && "lg:opacity-30",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("font-lp-mono text-sm tabular-nums transition-colors", ativo === i ? "text-lp-glow" : "text-lp-muted-2")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px w-10 bg-lp-line-2" />
                  <span className="font-lp-mono text-[12px] uppercase tracking-[0.14em] text-lp-muted">{a.rotulo}</span>
                </div>
                <h3 className="mt-4 font-lp-display text-[28px] font-bold leading-[1.08] tracking-[-0.025em] text-balance sm:text-4xl">{a.titulo}</h3>
                <p className="mt-4 text-[16px] leading-relaxed text-lp-muted sm:text-[17px]">{a.texto}</p>
                <ul className="mt-5 flex flex-col gap-2">
                  {a.detalhes.map((d) => (
                    <li key={d} className="flex items-start gap-2.5 text-sm text-lp-text/85">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-lp-accent" />
                      {d}
                    </li>
                  ))}
                </ul>
                {!desktop && (
                  <div className="mt-7 h-[440px]">
                    <a.Cena ativa={ativo === i} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {desktop && (
            <div className="relative">
              <div className="sticky top-[12vh] flex h-[76vh] max-h-[680px] flex-col gap-4">
                <div className="flex gap-1.5" role="tablist" aria-label="Etapas">
                  {ATOS.map((a, i) => (
                    <button
                      key={a.rotulo}
                      type="button"
                      role="tab"
                      aria-selected={ativo === i}
                      aria-label={`${i + 1}. ${a.rotulo}`}
                      onClick={() => irPara(i)}
                      className="group flex min-w-0 flex-1 flex-col gap-2 pt-1 text-left"
                    >
                      <span className="h-[3px] overflow-hidden rounded-full bg-lp-line">
                        <span
                          className={cn("block h-full rounded-full bg-lp-accent transition-[width] duration-700", i < ativo ? "w-full" : i === ativo ? "w-full bg-lp-glow" : "w-0")}
                        />
                      </span>
                      <span className={cn("truncate font-lp-mono text-[10px] uppercase tracking-[0.12em] transition-colors", i === ativo ? "text-lp-text" : "text-lp-muted-2 group-hover:text-lp-muted")}>
                        {String(i + 1).padStart(2, "0")} {a.rotulo}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="relative min-h-0 flex-1">
                  <div className="lp-aurora left-1/4 top-1/4 -z-10 h-[60%] w-[60%] opacity-30" aria-hidden="true" />
                  {ATOS.map((a, i) => (
                    <div key={a.rotulo} className="lp-cena absolute inset-0" data-ativa={ativo === i} aria-hidden={ativo !== i}>
                      <a.Cena ativa={ativo === i} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
