"use client";

import { Building2, Check, Globe, Loader2, Mail, MapPin, Phone, Search, Sparkles, Star, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "./dados";
import { useContagem, useLinhaDoTempo } from "./hooks";
import { Janela, Selo } from "./janela";

/* ── 01 · A IA monta a estratégia ─────────────────────────────── */

const RESPOSTAS = [
  ["O que você vende?", "Marketing e captação de pacientes para clínicas odontológicas"],
  ["Ticket médio", "R$ 2.500 por mês"],
  ["Quem decide a compra?", "Sócio(a) ou diretor(a) clínico(a)"],
  ["Quantas conversas a sua equipe atende por dia?", "Cerca de 30"],
] as const;

const ESTRATEGIAS = [
  { letra: "A", titulo: "Clínicas com CNPJ ativo há mais de 2 anos em MG", canal: "WhatsApp + e-mail · 6 contatos em 12 dias", volume: "~1.600 empresas/mês", selo: "Maior volume" },
  { letra: "B", titulo: "Clínicas com avaliação alta no Google Maps", canal: "WhatsApp · 5 contatos em 10 dias", volume: "~800 empresas/mês", selo: "Mais qualificada" },
  { letra: "C", titulo: "Dentistas proprietários de clínica no LinkedIn", canal: "Convite + 3 mensagens", volume: "~300 decisores/mês", selo: null },
];

export function CenaEstrategia({ ativa }: { ativa: boolean }) {
  const p = useLinhaDoTempo(ativa, [350, 650, 650, 650, 700, 1300, 260, 260]);
  const montando = p === 5;
  return (
    <Janela caminho="prospeccao-ativa / sua estratégia" status={p >= 6 ? <span className="text-lp-glow">3 estratégias prontas</span> : "questionário"}>
      <div className="flex h-full flex-col gap-2.5">
        {RESPOSTAS.map(([pergunta, resposta], i) =>
          p > i ? (
            <div key={pergunta} className="lp-entra flex flex-col gap-1 rounded-xl border border-lp-line bg-white/[0.02] px-3.5 py-2.5">
              <span className="text-[11px] text-lp-muted-2">{pergunta}</span>
              <span className={cn("text-sm text-lp-text", p === i + 1 && "lp-cursor")}>{resposta}</span>
            </div>
          ) : null,
        )}
        {montando && (
          <div className="lp-entra lp-varredura mt-1 flex items-center gap-2.5 rounded-xl border border-lp-accent/30 bg-lp-accent-soft px-3.5 py-3 text-sm text-lp-glow">
            <Sparkles className="h-4 w-4 shrink-0" /> Criando estratégias com base no seu plano e na capacidade da sua equipe…
          </div>
        )}
        {p >= 6 && (
          <div className="mt-1 grid gap-2">
            {ESTRATEGIAS.map((e, i) =>
              p >= 6 + i ? (
                <div
                  key={e.letra}
                  className={cn(
                    "lp-entra flex items-start gap-3 rounded-xl border px-3.5 py-3",
                    i === 0 ? "border-lp-accent/50 bg-lp-accent-soft shadow-[0_0_30px_-10px_rgba(0,200,83,0.6)]" : "border-lp-line bg-white/[0.02]",
                  )}
                >
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-lp-display text-sm font-bold", i === 0 ? "bg-lp-accent text-[#04140a]" : "bg-white/[0.06] text-lp-text")}>
                    {e.letra}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-lp-text">{e.titulo}</span>
                      {e.selo && <Selo tom={i === 0 ? "verde" : "neutro"}>{e.selo}</Selo>}
                    </div>
                    <p className="mt-0.5 font-lp-mono text-[11px] text-lp-muted">{e.canal} · {e.volume}</p>
                  </div>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    </Janela>
  );
}

/* ── 02 · Acha as empresas ────────────────────────────────────── */

const FILTROS = ["Odontologia · 8630-5/04", "Minas Gerais", "Aberta há mais de 2 anos", "Com telefone"];
const EMPRESAS = [
  ["Sorriso Pleno Odontologia", "Belo Horizonte", "2014"],
  ["Clínica Dra. Ana Ribeiro", "Contagem", "2017"],
  ["OdontoVida Savassi", "Belo Horizonte", "2011"],
  ["Instituto Dental Triângulo", "Uberlândia", "2009"],
  ["Oral Center Juiz de Fora", "Juiz de Fora", "2016"],
  ["Clínica Sorrir Mais", "Betim", "2019"],
  ["Odonto Prime Pampulha", "Belo Horizonte", "2015"],
];

export function CenaBusca({ ativa }: { ativa: boolean }) {
  const p = useLinhaDoTempo(ativa, [300, 380, 380, 380, 500, 900, 170, 170, 170, 170, 170, 170, 170]);
  const total = useContagem(2410, p >= 6, 2200);
  const fontes = ["CNPJ", "Google Maps", "Instagram", "LinkedIn"];
  return (
    <Janela caminho="prospeccao-ativa / buscar empresas" status={p >= 6 ? <span className="lp-numero text-lp-glow">{num(total)} encontradas</span> : "nova busca"}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex gap-1 rounded-xl border border-lp-line bg-white/[0.02] p-1">
          {fontes.map((f, i) => (
            <span key={f} className={cn("flex-1 truncate rounded-lg px-2 py-1.5 text-center text-[11.5px]", i === 0 ? "bg-lp-accent-soft font-semibold text-lp-glow" : "text-lp-muted-2")}>
              {f}
            </span>
          ))}
        </div>
        <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-xl border border-lp-line-2 bg-lp-bg/60 px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-lp-muted-2" />
          {FILTROS.map((f, i) =>
            p > i ? (
              <span key={f} className="lp-entra rounded-full border border-lp-accent/35 bg-lp-accent-soft px-2.5 py-0.5 text-[11.5px] text-lp-glow">{f}</span>
            ) : null,
          )}
          {p < 4 && <span className="lp-cursor text-[12px] text-lp-muted-2" />}
        </div>
        {p === 5 && (
          <div className="lp-entra lp-varredura flex items-center gap-2 rounded-xl border border-lp-line bg-white/[0.02] px-3 py-2.5 text-[13px] text-lp-muted">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lp-accent motion-reduce:animate-none" /> Consultando a Receita Federal e removendo empresas já abordadas…
          </div>
        )}
        {p >= 6 && (
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-lp-line">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-lp-line bg-white/[0.02] px-3 py-2 font-lp-mono text-[10px] uppercase tracking-[0.12em] text-lp-muted-2">
              <span>Empresa</span><span className="hidden sm:block">Desde</span><span>Contato</span>
            </div>
            {EMPRESAS.map(([nome, cidade, desde], i) =>
              p >= 6 + i ? (
                <div key={nome} className="lp-entra-lado grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-lp-line/60 px-3 py-2 last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-lp-text">{nome}</span>
                    <span className="flex items-center gap-1 text-[11px] text-lp-muted-2"><MapPin className="h-3 w-3" />{cidade}</span>
                  </span>
                  <span className="hidden font-lp-mono text-[11px] text-lp-muted sm:block">{desde}</span>
                  <span className="flex gap-1 text-lp-accent"><Phone className="h-3.5 w-3.5" /><Globe className={cn("h-3.5 w-3.5", i % 3 === 1 && "text-lp-muted-2/50")} /></span>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    </Janela>
  );
}

/* ── 03 · Descobre quem decide ─────────────────────────────────── */

const DADOS_DECISOR = [
  { icone: UserRound, rotulo: "Sócia-administradora", valor: "Mariana Costa", fonte: "Receita Federal" },
  { icone: Phone, rotulo: "Celular", valor: "(31) 9 8•••-••42", fonte: "Enriquecimento" },
  { icone: Mail, rotulo: "E-mail", valor: "mariana@sorrisopleno.com.br", fonte: "Enriquecimento" },
  { icone: Star, rotulo: "Google", valor: "4,8 · 212 avaliações", fonte: "Google Maps" },
  { icone: Globe, rotulo: "Site", valor: "sorrisopleno.com.br", fonte: "Google Maps" },
];

export function CenaDecisor({ ativa }: { ativa: boolean }) {
  const p = useLinhaDoTempo(ativa, [300, 900, 420, 420, 420, 420, 420, 500]);
  return (
    <Janela caminho="prospeccao-ativa / lead / sorriso-pleno" status={p >= 7 ? <span className="text-lp-glow">pronto para abordagem</span> : "enriquecendo"}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-lp-line bg-white/[0.02] px-3.5 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-lp-muted"><Building2 className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-lp-text">Sorriso Pleno Odontologia LTDA</p>
            <p className="truncate font-lp-mono text-[11px] text-lp-muted-2">CNPJ 12.•••.•••/0001-•• · Belo Horizonte · desde 2014</p>
          </div>
        </div>
        {p === 1 && (
          <div className="lp-entra lp-varredura flex items-center gap-2 rounded-xl border border-lp-line bg-white/[0.02] px-3 py-2.5 text-[13px] text-lp-muted">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lp-accent motion-reduce:animate-none" /> Cruzando dados da Receita Federal, do Google Maps e de enriquecimento…
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {DADOS_DECISOR.map((d, i) =>
            p >= 2 + i ? (
              <div key={d.rotulo} className="lp-entra-lado flex items-center gap-3 rounded-xl border border-lp-line bg-lp-bg/50 px-3 py-2">
                <d.icone className="h-4 w-4 shrink-0 text-lp-accent" />
                <span className="w-24 shrink-0 text-[11.5px] text-lp-muted-2 sm:w-36">{d.rotulo}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-lp-text">{d.valor}</span>
                <span className="hidden shrink-0 font-lp-mono text-[10px] uppercase tracking-[0.1em] text-lp-muted-2 sm:block">{d.fonte}</span>
              </div>
            ) : null,
          )}
        </div>
        {p >= 7 && (
          <div className="lp-entra mt-auto flex items-center gap-2.5 rounded-xl border border-lp-accent/50 bg-lp-accent-soft px-3.5 py-3 shadow-[0_0_40px_-12px_rgba(0,200,83,0.7)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lp-accent text-[#04140a]"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
            <span className="text-sm font-semibold text-lp-glow">Decisor identificado. Lead incluído na cadência de amanhã.</span>
          </div>
        )}
      </div>
    </Janela>
  );
}
