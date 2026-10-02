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
    rotulo: "Estratégia sob medida",
    titulo: "Você descreve o seu negócio. A IA monta a estratégia.",
    texto:
      "O que você vende, para quem, qual o ticket, quem decide a compra e quantas conversas a sua equipe consegue atender. A partir dessas respostas, a IA define de onde vêm os leads, quais canais usar, o volume diário e as mensagens de cada etapa.",
    detalhes: ["Estratégias prontas para escolher e ajustar", "Volume calculado de acordo com o seu plano"],
    Cena: CenaEstrategia,
  },
  {
    rotulo: "Leads com o perfil certo",
    titulo: "Milhares de empresas com o perfil do seu cliente ideal.",
    texto:
      "Base de CNPJ da Receita Federal com filtros por atividade, cidade, porte e tempo de abertura. Google Maps para negócios locais, com nota e avaliações. Instagram e LinkedIn quando o seu público está lá. Empresas já abordadas não voltam para a lista.",
    detalhes: ["Buscas pontuais ou agendadas diariamente", "Sem leads duplicados entre campanhas"],
    Cena: CenaBusca,
  },
  {
    rotulo: "Contato do decisor",
    titulo: "A conversa começa com quem decide.",
    texto:
      "Sócios, celular, e-mail, site e avaliações no Google. A plataforma cruza as fontes para que a abordagem chegue a quem assina o contrato, e não a um e-mail genérico do comercial.",
    detalhes: ["Telefone e site validados no Google Maps", "Contato do decisor por enriquecimento de dados"],
    Cena: CenaDecisor,
  },
  {
    rotulo: "Cadência multicanal",
    titulo: "O follow-up acontece sempre, no momento certo.",
    texto:
      "Sequências com várias mensagens por WhatsApp, e-mail e LinkedIn, com intervalos definidos, apenas em horário comercial e em um ritmo que protege o seu número. Cada mensagem é personalizada com o nome da pessoa, o da empresa e o motivo do contato.",
    detalhes: ["Teste A/B para descobrir a mensagem que mais converte", "Status de entrega, leitura e resposta de cada mensagem"],
    Cena: CenaCadencia,
  },
  {
    rotulo: "Funil integrado",
    titulo: "Quem responde entra automaticamente no seu funil.",
    texto:
      "A cadência é pausada para quem respondeu, o card vai para a etapa certa e você assume a conversa. A mudança de etapa pode disparar a próxima automação: lembrete de reunião, envio de proposta ou o que fizer sentido no seu processo.",
    detalhes: ["Funil em Kanban adaptado ao seu processo comercial", "Automações disparadas pela etapa do card"],
    Cena: CenaFunil,
  },
  {
    rotulo: "Resultado mensurável",
    titulo: "No fim do mês, os números mostram o caminho.",
    texto:
      "Empresas abordadas, respostas, reuniões e contratos fechados. Você identifica em que ponto o funil perde força e ajusta a mensagem, o público ou o ritmo com base em dados.",
    detalhes: ["Relatórios por campanha e por canal", "Exemplo ilustrativo com taxas de mercado"],
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
            Do primeiro contato à reunião marcada,{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">em seis etapas.</span>
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
                  <div className="mt-7 h-[520px]">
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
                  <div className="lp-aurora left-1/4 top-1/4 -z-10 h-[60%] w-[60%] opacity-30 [--pico:0.25]" aria-hidden="true" />
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
