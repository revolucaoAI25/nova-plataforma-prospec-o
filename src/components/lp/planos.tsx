"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, linkAssinar, linkWhatsApp, num, type PlanoLP } from "./dados";
import { usePlanoSugerido } from "./hooks";
import { Revela } from "./revela";

const SEMPRE = ["Busca por CNPJ e Google Maps", "Estratégia criada por IA", "Funil, automações e cadências"];

export function Planos({ planos }: { planos: PlanoLP[] }) {
  const sugerido = usePlanoSugerido();
  const temAnual = planos.some((p) => p.precoAnual);
  // O anual vem marcado por padrão quando algum plano tem preço anual.
  const [ciclo, setCiclo] = useState<"mensal" | "anual">(temAnual ? "anual" : "mensal");
  // O plano do meio é o recomendado; com dois planos, o de cima.
  const recomendado = planos.length ? planos[Math.floor(planos.length / 2)].id : null;

  return (
    <section id="planos" className="relative scroll-mt-20 border-t border-lp-line bg-lp-bg-2 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Revela className="mx-auto max-w-3xl text-center">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Planos</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            Escolha o plano ideal{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">para o seu volume de prospecção.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-lp-muted">
            Todos os planos incluem créditos mensais. Se precisar de mais, é possível adquirir pacotes avulsos a qualquer momento.
          </p>
          {temAnual && (
            <div className="mx-auto mt-8 inline-flex rounded-full border border-lp-line-2 bg-lp-surface p-1" role="radiogroup" aria-label="Forma de cobrança">
              {(["mensal", "anual"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={ciclo === c}
                  onClick={() => setCiclo(c)}
                  className={cn(
                    "rounded-full px-5 py-2 text-sm font-medium transition-colors",
                    ciclo === c ? "bg-lp-accent text-[#04140a]" : "text-lp-muted hover:text-lp-text",
                  )}
                >
                  {c === "mensal" ? "Mensal" : "Anual"}
                </button>
              ))}
            </div>
          )}
        </Revela>

        {planos.length ? (
          <div className={cn("mx-auto mt-12 grid grid-cols-1 gap-4 sm:mt-14", planos.length >= 3 ? "lg:grid-cols-3" : planos.length === 2 ? "max-w-4xl md:grid-cols-2" : "max-w-md")}>
            {planos.map((p, i) => {
              const destaque = recomendado === p.id;
              const anual = ciclo === "anual" && p.precoAnual !== null;
              const precoExibido = anual ? (p.precoAnual as number) / 12 : p.precoMes;
              return (
                <Revela key={p.id} atraso={i * 90}>
                  <div
                    className={cn(
                      "relative flex h-full flex-col rounded-[28px] border p-7 sm:p-8",
                      destaque
                        ? "border-lp-accent/60 bg-gradient-to-b from-[#0c2318] to-lp-surface shadow-[0_0_0_1px_rgba(93,255,160,0.25),0_30px_80px_-30px_rgba(0,200,83,0.55)] lg:-my-3 lg:py-11"
                        : "border-lp-line bg-lp-surface",
                    )}
                  >
                    {destaque && (
                      <span className="absolute -top-3 left-7 rounded-full bg-lp-accent px-3 py-1 font-lp-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#04140a]">
                        Recomendado
                      </span>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-lp-display text-2xl font-bold tracking-tight">{p.nome}</h3>
                      {sugerido === p.id && (
                        <span className="lp-entra inline-flex items-center gap-1 rounded-full border border-lp-accent/40 bg-lp-accent-soft px-2.5 py-0.5 text-[11px] text-lp-glow">
                          <Sparkles className="h-3 w-3" /> Indicado na sua simulação
                        </span>
                      )}
                    </div>
                    {p.descricao && <p className="mt-1.5 text-sm text-lp-muted">{p.descricao}</p>}
                    <p className="mt-6 flex items-baseline gap-1">
                      <span className="lp-numero font-lp-display text-5xl font-extrabold tracking-[-0.03em]">{brl(precoExibido)}</span>
                      <span className="text-lp-muted">/mês</span>
                    </p>
                    <p className="mt-1 min-h-[20px] text-[13px] text-lp-muted-2">
                      {anual
                        ? `${brl(p.precoAnual as number)} cobrados uma vez por ano`
                        : p.precoAnual
                          ? `ou ${brl(p.precoAnual / 12)}/mês no plano anual`
                          : "Sem fidelidade"}
                    </p>
                    <div className="mt-6 rounded-2xl border border-lp-line bg-lp-bg/50 px-4 py-3">
                      <p className="lp-numero font-lp-display text-lg font-bold text-lp-glow">{num(p.creditosMes)} créditos por mês</p>
                      {p.empresasMes !== null && (
                        <p className="mt-0.5 text-[13px] text-lp-muted">
                          Até <span className="lp-numero font-semibold text-lp-text">{num(p.empresasMes)}</span> empresas extraídas por mês
                        </p>
                      )}
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
                      href={linkAssinar(p.id, anual ? "anual" : "mensal")}
                      className={cn(
                        "group mt-8 inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow",
                        destaque ? "bg-lp-accent text-[#04140a] hover:bg-lp-glow" : "border border-lp-line-2 text-lp-text hover:border-lp-accent/60 hover:bg-white/[0.03]",
                      )}
                    >
                      Assinar o {p.nome}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </Revela>
              );
            })}
          </div>
        ) : (
          <Revela className="mx-auto mt-12 max-w-xl rounded-[28px] border border-lp-line bg-lp-surface p-8 text-center">
            <p className="text-lg text-lp-text">Os planos acompanham o volume de prospecção da sua empresa.</p>
            <p className="mt-2 text-lp-muted">Conte para a nossa equipe quantas empresas você quer abordar por mês e indicaremos o plano ideal.</p>
            <a
              href={linkWhatsApp("Olá! Gostaria de saber qual plano é o mais indicado para o meu volume de prospecção.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lp-accent px-6 text-[15px] font-semibold text-[#04140a] transition-colors hover:bg-lp-glow"
            >
              Falar com um especialista <ArrowUpRight className="h-4 w-4" />
            </a>
          </Revela>
        )}

        {planos.length > 0 && (
          <Revela className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-5 text-center">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-lp-line bg-lp-surface px-6 py-5 sm:flex-row sm:text-left">
              <ShieldCheck className="h-8 w-8 shrink-0 text-lp-accent" />
              <p className="text-[15px] leading-relaxed text-lp-muted">
                <strong className="font-semibold text-lp-text">Garantia de 7 dias.</strong> Se a plataforma não fizer sentido para a sua empresa, devolvemos 100% do valor pago.
              </p>
            </div>
            <p className="text-[15px] text-lp-muted">
              Prefere conhecer antes?{" "}
              <Link href="/teste-gratis" className="-my-2 inline-block py-2 font-semibold text-lp-glow underline-offset-4 hover:underline">
                Faça o teste grátis, sem cartão
              </Link>
            </p>
            <p className="flex items-center justify-center gap-2 text-[13px] text-lp-muted-2">
              <Lock className="h-3.5 w-3.5 shrink-0" /> Pagamento seguro por Pix, boleto ou cartão. Acesso liberado assim que o pagamento é confirmado.
            </p>
          </Revela>
        )}
      </div>
    </section>
  );
}
