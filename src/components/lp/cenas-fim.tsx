"use client";

import { Briefcase, CalendarCheck, CheckCheck, Mail, MessageCircle, PauseCircle, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, num } from "./dados";
import { useContagem, useLinhaDoTempo } from "./hooks";
import { Janela, Selo } from "./janela";

/* ── 04 · Cadência ─────────────────────────────────────────────── */

const TOQUES = [
  { dia: "Dia 1 · seg 9:12", canal: "whatsapp" as const, texto: "Oi, Mariana, tudo bem? Vi que a Sorriso Pleno tem 4,8 no Google com mais de 200 avaliações, bem acima da média. Pergunta rápida: a confirmação de consulta aí ainda é por telefone?" },
  { dia: "Dia 3 · qua 10:05", canal: "email" as const, assunto: "Faltas na agenda da Sorriso Pleno", texto: "Mariana, te mandei uma mensagem no WhatsApp também. Clínica com o movimento de vocês costuma perder alguns horários por semana com paciente que não aparece. Se quiser, te mostro como outras clínicas de BH resolveram isso sem contratar ninguém." },
  { dia: "Dia 6 · seg 8:47", canal: "whatsapp" as const, texto: "Sei que a rotina aí é corrida. Se fizer sentido, te mostro em 15 minutos. Quinta à tarde funciona?" },
];

const ICONE_CANAL = { whatsapp: MessageCircle, email: Mail, linkedin: Briefcase };

export function CenaCadencia({ ativa }: { ativa: boolean }) {
  const p = useLinhaDoTempo(ativa, [300, 1100, 1300, 1300, 1400, 900, 700]);
  return (
    <Janela caminho="prospeccao-ativa / campanha / clinicas-mg" status={<span>teste A/B · variante B</span>}>
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center gap-3 border-b border-lp-line pb-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2b3a33] to-[#16201b] text-xs font-bold text-lp-text">MC</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-lp-text">Mariana Costa</p>
            <p className="truncate text-[11px] text-lp-muted-2">Sorriso Pleno Odontologia · etapa {Math.min(3, Math.max(1, p))} de 6</p>
          </div>
          {p >= 5 ? <Selo tom="verde">respondeu</Selo> : <Selo>na cadência</Selo>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden">
          {TOQUES.map((t, i) => {
            if (p < i + 1) return null;
            const Icone = ICONE_CANAL[t.canal];
            const lida = p >= i + 2;
            return (
              <div key={t.dia} className="lp-entra flex flex-col items-end gap-1">
                <span className="flex items-center gap-1.5 font-lp-mono text-[10px] uppercase tracking-[0.1em] text-lp-muted-2">
                  <Icone className="h-3 w-3" /> {t.dia}
                </span>
                <div className="max-w-[92%] rounded-2xl rounded-tr-md border border-lp-accent/25 bg-[#0f2a1c] px-3 py-2 text-[12.5px] leading-snug text-[#dff5e8]">
                  {"assunto" in t && <p className="mb-1 font-semibold text-lp-text">{t.assunto}</p>}
                  {t.texto}
                  <span className={cn("mt-1 flex items-center justify-end gap-1 font-lp-mono text-[10px]", lida ? "text-lp-glow" : "text-lp-muted-2")}>
                    <CheckCheck className="h-3 w-3" /> {lida ? "lida" : "entregue"}
                  </span>
                </div>
              </div>
            );
          })}
          {p >= 5 && (
            <div className="lp-entra flex flex-col items-start gap-1">
              <span className="font-lp-mono text-[10px] uppercase tracking-[0.1em] text-lp-muted-2">seg 11:32</span>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-lp-line-2 bg-lp-surface-2 px-3 py-2 text-[12.5px] leading-snug text-lp-text">
                Oi! Quinta 17h pode ser? Tenho interesse sim, a gente perde muito horário.
              </div>
            </div>
          )}
          {p >= 6 && (
            <div className="lp-entra flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f5b544]/30 bg-[#f5b544]/10 px-2.5 py-1 text-[11px] text-[#f5c46b]">
                <PauseCircle className="h-3.5 w-3.5" /> Cadência pausada pra ela
              </span>
              {p >= 7 && (
                <span className="lp-entra inline-flex items-center gap-1.5 rounded-full border border-lp-accent/40 bg-lp-accent-soft px-2.5 py-1 text-[11px] text-lp-glow">
                  <Workflow className="h-3.5 w-3.5" /> Card movido pra &ldquo;Respondeu&rdquo;
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Janela>
  );
}

/* ── 05 · Funil ─────────────────────────────────────────────────── */

const COLUNAS = ["Abordados", "Responderam", "Reunião", "Fechado"] as const;
const BASE_COLUNAS = [812, 64, 19, 5];
const FIXOS: [number, string, string][] = [
  [0, "Grupo Vértice", "etapa 3/6"], [0, "Oral Center", "etapa 2/6"], [0, "OdontoVida", "etapa 5/6"],
  [1, "Clínica Sorrir Mais", "há 2 h"], [2, "Dra. Ana Ribeiro", "ter 10h"], [3, "Instituto Triângulo", "R$ 390/mês"],
];

export function CenaFunil({ ativa }: { ativa: boolean }) {
  const p = useLinhaDoTempo(ativa, [500, 1300, 1400, 900]);
  const coluna = p >= 2 ? 2 : 1;
  const contagens = BASE_COLUNAS.map((b, i) => b + (i === 1 && p >= 1 ? 1 : 0) + (i === 2 && p >= 2 ? 1 : 0) - (i === 1 && p >= 2 ? 1 : 0));
  return (
    <Janela caminho="prospeccao-ativa / funil / clinicas-mg" status="atualiza sozinho">
      <div className="flex h-full flex-col gap-3">
        <div className="grid min-h-0 flex-1 grid-cols-4 gap-2">
          {COLUNAS.map((c, ci) => (
            <div key={c} className={cn("flex min-w-0 flex-col gap-1.5 rounded-xl border p-1.5 transition-colors duration-500", ci === coluna && p >= 1 ? "border-lp-accent/40 bg-lp-accent-soft/50" : "border-lp-line bg-white/[0.015]")}>
              <div className="flex items-baseline justify-between gap-1 px-1 pt-0.5">
                <span className="truncate text-[10.5px] font-semibold text-lp-muted sm:text-[11.5px]">{c}</span>
                <span className="lp-numero font-lp-mono text-[10.5px] text-lp-muted-2">{num(contagens[ci])}</span>
              </div>
              {ci === coluna && p >= 1 && (
                <div key={`mariana-${p >= 2 ? 2 : 1}`} className="lp-entra rounded-lg border border-lp-accent/60 bg-lp-surface-2 p-1.5 shadow-[0_0_24px_-6px_rgba(0,200,83,0.7)] sm:p-2">
                  <p className="truncate text-[11px] font-semibold text-lp-text sm:text-[12px]">Sorriso Pleno</p>
                  <p className="truncate text-[10px] text-lp-glow">{p >= 2 ? "qui 17h" : "respondeu agora"}</p>
                </div>
              )}
              {ci === 0 && p < 1 && (
                <div className="rounded-lg border border-lp-line-2 bg-lp-surface-2 p-1.5 sm:p-2">
                  <p className="truncate text-[11px] font-semibold text-lp-text sm:text-[12px]">Sorriso Pleno</p>
                  <p className="truncate text-[10px] text-lp-muted-2">etapa 3/6</p>
                </div>
              )}
              {FIXOS.filter(([col]) => col === ci).map(([, nome, info]) => (
                <div key={nome} className="rounded-lg border border-lp-line bg-lp-surface-2/70 p-1.5 sm:p-2">
                  <p className="truncate text-[11px] text-lp-text/90 sm:text-[12px]">{nome}</p>
                  <p className="truncate text-[10px] text-lp-muted-2">{info}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex min-h-[44px] flex-col gap-1.5">
          {p >= 2 && (
            <div className="lp-entra flex items-center gap-2 rounded-xl border border-lp-accent/40 bg-lp-accent-soft px-3 py-2 text-[12.5px] text-lp-glow">
              <CalendarCheck className="h-4 w-4 shrink-0" /> Reunião marcada com Mariana · quinta, 17h
            </div>
          )}
          {p >= 3 && (
            <div className="lp-entra flex items-center gap-2 rounded-xl border border-lp-line bg-white/[0.02] px-3 py-2 text-[12.5px] text-lp-muted">
              <Workflow className="h-4 w-4 shrink-0 text-lp-accent" /> Fluxo disparado: lembrete da reunião vai sair na quinta de manhã
            </div>
          )}
        </div>
      </div>
    </Janela>
  );
}

/* ── 06 · Resultado ─────────────────────────────────────────────── */

const SEMANAS = [3, 4, 5, 7];

export function CenaResultado({ ativa }: { ativa: boolean }) {
  const p = useLinhaDoTempo(ativa, [250, 500, 500]);
  const ligado = p >= 1;
  const encontradas = useContagem(1284, ligado, 1500);
  const abordadas = useContagem(812, ligado, 1700);
  const conversas = useContagem(64, ligado, 1900);
  const reunioes = useContagem(19, ligado, 2100);
  const contratos = useContagem(5, ligado, 2300);
  const receita = useContagem(1950, p >= 2, 1800);
  const linhas = [
    ["Empresas encontradas", encontradas],
    ["Abordadas", abordadas],
    ["Responderam", conversas],
    ["Reuniões", reunioes],
    ["Contratos", contratos],
  ] as const;
  return (
    <Janela caminho="prospeccao-ativa / relatório / outubro" status="30 dias">
      <div className="flex h-full flex-col gap-3">
        <div className="grid grid-cols-5 gap-1.5">
          {linhas.map(([rotulo, v], i) => (
            <div key={rotulo} className={cn("rounded-xl border px-2 py-2.5", i === 4 ? "border-lp-accent/40 bg-lp-accent-soft" : "border-lp-line bg-white/[0.02]")}>
              <p className="truncate text-[9.5px] leading-tight text-lp-muted-2 sm:text-[10.5px]">{rotulo}</p>
              <p className={cn("lp-numero mt-1 font-lp-display text-base font-bold tracking-tight sm:text-xl", i === 4 ? "text-lp-glow" : "text-lp-text")}>{num(v)}</p>
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-lp-line bg-white/[0.015] p-3">
          <p className="font-lp-mono text-[10px] uppercase tracking-[0.12em] text-lp-muted-2">Reuniões por semana</p>
          <div className="mt-auto flex items-end gap-3 pt-2">
            {SEMANAS.map((s, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="lp-numero font-lp-mono text-[11px] text-lp-muted">{ligado ? s : ""}</span>
                <div
                  className="w-full origin-bottom rounded-t-md bg-gradient-to-t from-lp-accent/40 to-lp-glow transition-transform duration-1000 ease-out"
                  style={{ height: `${(s / 7) * 96}px`, transform: `scaleY(${ligado ? 1 : 0.04})`, transitionDelay: `${i * 140}ms` }}
                />
                <span className="font-lp-mono text-[10px] text-lp-muted-2">S{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-lp-accent/50 bg-gradient-to-br from-lp-accent/20 to-transparent px-4 py-3">
          <p className="text-[11.5px] text-lp-muted">Receita recorrente nova</p>
          <p className="lp-numero font-lp-display text-3xl font-extrabold tracking-tight text-lp-glow sm:text-4xl">
            {brl(receita)}<span className="text-base font-semibold text-lp-muted">/mês</span>
          </p>
          <p className={cn("text-[12px] text-lp-muted transition-opacity duration-700", p >= 3 ? "opacity-100" : "opacity-0")}>
            São {brl(23400)} em 12 meses, de um mês de prospecção.
          </p>
        </div>
      </div>
    </Janela>
  );
}
