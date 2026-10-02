"use client";

import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, linkWhatsApp, num, type PlanoLP } from "./dados";
import { usePlanoSugerido } from "./hooks";
import { Revela } from "./revela";

const SEMPRE = ["Busca por CNPJ e Google Maps", "Estratégia montada por IA", "Funil, fluxos e cadências"];

export function Planos({ planos, creditosPorLead }: { planos: PlanoLP[]; creditosPorLead: number }) {
  const sugerido = usePlanoSugerido();

  return (
    <section id="planos" className="relative scroll-mt-20 border-t border-lp-line bg-lp-bg-2 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Revela className="mx-auto max-w-3xl text-center">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Planos</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            Escolha o tamanho{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">da sua máquina.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-lp-muted">
            Todo plano vem com créditos mensais. Acabou antes do mês virar? Compra um pacote avulso e segue.
          </p>
        </Revela>

        {planos.length ? (
          <div className={cn("mx-auto mt-12 grid gap-4 sm:mt-16", planos.length >= 3 ? "lg:grid-cols-3" : planos.length === 2 ? "max-w-4xl md:grid-cols-2" : "max-w-md")}>
            {planos.map((p, i) => {
              const destaque = sugerido === p.id;
              return (
                <Revela key={p.id} atraso={i * 90}>
                  <div
                    className={cn(
                      "relative flex h-full flex-col rounded-[28px] border p-7 transition-[border-color,box-shadow] duration-500 sm:p-8",
                      destaque
                        ? "border-lp-accent/60 bg-gradient-to-b from-[#0c2318] to-lp-surface shadow-[0_0_0_1px_rgba(93,255,160,0.25),0_30px_80px_-30px_rgba(0,200,83,0.55)]"
                        : "border-lp-line bg-lp-surface",
                    )}
                  >
                    {destaque && (
                      <span className="lp-entra absolute -top-3 left-7 rounded-full bg-lp-accent px-3 py-1 font-lp-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#04140a]">
                        Cabe na sua conta
                      </span>
                    )}
                    <h3 className="font-lp-display text-2xl font-bold tracking-tight">{p.nome}</h3>
                    {p.descricao && <p className="mt-1.5 text-sm text-lp-muted">{p.descricao}</p>}
                    <p className="mt-6 flex items-baseline gap-1">
                      <span className="lp-numero font-lp-display text-5xl font-extrabold tracking-[-0.03em]">{brl(p.precoMes)}</span>
                      <span className="text-lp-muted">/mês</span>
                    </p>
                    <p className="mt-1 min-h-[20px] text-[13px] text-lp-muted-2">
                      {p.precoAnual ? `ou ${brl(p.precoAnual)} no anual (${brl(p.precoAnual / 12)}/mês)` : "Sem fidelidade"}
                    </p>
                    <div className="mt-6 rounded-2xl border border-lp-line bg-lp-bg/50 px-4 py-3">
                      <p className="lp-numero font-lp-display text-lg font-bold text-lp-glow">{num(p.creditosMes)} créditos/mês</p>
                      <p className="text-[13px] text-lp-muted">dá pra uns {num(p.creditosMes / creditosPorLead)} contatos novos por mês</p>
                    </div>
                    <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                      {[...SEMPRE, ...p.recursos].map((r) => (
                        <li key={r} className="flex items-start gap-2.5 text-[14.5px] text-lp-text/90">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-lp-accent" />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={linkWhatsApp(`Oi! Quero começar no plano ${p.nome} da plataforma de prospecção.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "group mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow",
                        destaque ? "bg-lp-accent text-[#04140a] hover:bg-lp-glow" : "border border-lp-line-2 text-lp-text hover:border-lp-accent/60 hover:bg-white/[0.03]",
                      )}
                    >
                      Começar com o {p.nome}
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </Revela>
              );
            })}
          </div>
        ) : (
          <Revela className="mx-auto mt-12 max-w-xl rounded-[28px] border border-lp-line bg-lp-surface p-8 text-center">
            <p className="text-lg text-lp-text">Os planos acompanham o volume que você quer rodar.</p>
            <p className="mt-2 text-lp-muted">Conta pra gente quantas empresas quer abordar por mês que a gente te mostra o plano certo.</p>
            <a
              href={linkWhatsApp("Oi! Quero entender qual plano faz sentido pro meu volume de prospecção.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lp-accent px-6 text-[15px] font-semibold text-[#04140a] transition-colors hover:bg-lp-glow"
            >
              Ver o plano certo pra mim <ArrowUpRight className="h-4 w-4" />
            </a>
          </Revela>
        )}
      </div>
    </section>
  );
}
