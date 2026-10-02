"use client";

import type { PointerEvent, ReactNode } from "react";
import {
  CheckCheck, Coins, FileSpreadsheet, FlaskConical, Layers, QrCode, ShieldCheck, Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Revela } from "./revela";

function aoMover(e: PointerEvent<HTMLDivElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div onPointerMove={aoMover} className={cn("lp-holofote h-full rounded-3xl border border-lp-line p-6 transition-colors hover:border-lp-line-2", className)}>
      {children}
    </div>
  );
}

const RECURSOS: [LucideIcon, string, string][] = [
  [Workflow, "Fluxos em blocos", "Buscar, filtrar, enriquecer, mandar pro funil, disparar. Você monta encaixando os blocos e deixa rodar no horário que quiser."],
  [ShieldCheck, "Ritmo que protege seu número", "Janela de horário, limite de contatos novos por dia e intervalo entre mensagens. E saída fácil pra quem não quer receber."],
  [FlaskConical, "Teste A/B", "Duas versões da mesma mensagem rodando juntas. Você vê qual responde mais e fica com a melhor."],
  [CheckCheck, "Entregue, lida, respondida", "O status de cada mensagem, em cada canal. Dá pra saber o que está funcionando sem achismo."],
  [QrCode, "QR Code ou API oficial", "Conecta seu WhatsApp em um minuto pelo QR Code, ou usa a API oficial da Meta quando o volume pedir."],
  [Layers, "Nunca o mesmo lead duas vezes", "Quem já foi abordado não volta pra lista, mesmo entre campanhas e fontes diferentes."],
  [FileSpreadsheet, "Google Sheets e Excel", "Exporta quando quiser. O que você extraiu continua seu, com ou sem assinatura."],
  [Coins, "Um saldo só de créditos", "Busca, enriquecimento e canais saem do mesmo saldo. Você coloca onde está dando resultado."],
];

const FONTES = ["CNPJ", "Google Maps", "Instagram", "LinkedIn"];
const CANAIS = ["WhatsApp", "E-mail", "LinkedIn"];

export function Recursos() {
  return (
    <section className="relative border-t border-lp-line py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Revela className="max-w-3xl">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Por baixo do capô</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            Tudo o que roda{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">enquanto você atende cliente.</span>
          </h2>
        </Revela>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
          <Revela className="sm:col-span-2 lg:row-span-2">
            <Cartao className="flex flex-col justify-between gap-8 p-7 sm:p-8">
              <div>
                <h3 className="font-lp-display text-2xl font-bold tracking-tight sm:text-3xl">Quatro fontes. Três canais. Um funil.</h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-lp-muted">
                  Você não precisa de uma ferramenta pra lista, outra pra disparo e uma planilha pra controlar quem respondeu. Está tudo no mesmo lugar, conversando entre si.
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2 sm:gap-3" aria-hidden="true">
                <div className="flex flex-col gap-2">
                  {FONTES.map((f) => (
                    <span key={f} className="truncate rounded-xl border border-lp-line bg-white/[0.03] px-2.5 py-2 text-center font-lp-mono text-[10.5px] text-lp-muted sm:py-3 sm:text-[13px]">{f}</span>
                  ))}
                </div>
                <span className="h-px w-4 bg-gradient-to-r from-lp-line-2 to-lp-accent sm:w-8" />
                <div className="flex flex-col gap-2">
                  {CANAIS.map((c) => (
                    <span key={c} className="truncate rounded-xl border border-lp-accent/30 bg-lp-accent-soft px-2.5 py-2 text-center font-lp-mono text-[10.5px] text-lp-glow sm:py-3 sm:text-[13px]">{c}</span>
                  ))}
                </div>
                <span className="h-px w-4 bg-gradient-to-r from-lp-accent to-lp-glow sm:w-8" />
                <span className="lp-estacao-pulso rounded-2xl border border-lp-glow bg-lp-accent px-3 py-3 font-lp-display text-sm font-bold text-[#04140a] sm:px-5 sm:py-5 sm:text-base">Funil</span>
              </div>
            </Cartao>
          </Revela>
          {RECURSOS.map(([Icone, titulo, texto], i) => (
            <Revela key={titulo} atraso={(i % 4) * 70}>
              <Cartao>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lp-accent/25 bg-lp-accent-soft text-lp-glow">
                  <Icone className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-lp-display text-lg font-bold tracking-tight">{titulo}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-lp-muted">{texto}</p>
              </Cartao>
            </Revela>
          ))}
        </div>
      </div>
    </section>
  );
}
