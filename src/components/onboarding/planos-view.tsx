"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BadgeCheck, ChevronRight, Coins, Gauge, Lightbulb, Loader2, PencilLine, RotateCcw,
  Sparkles, Star, Target, ThumbsUp, TrendingUp, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-provider";
import { cn } from "@/lib/utils";
import type { AvaliacaoPlano, PlanoOnboarding, ResultadoOnboarding } from "@/lib/onboarding/ia";
import type { AplicacaoRow } from "@/lib/onboarding/aplicar";
import { ETAPAS_AUTOMATICAS, etapasDoFunil } from "@/lib/onboarding/funil";
import { MensagensPreview } from "./mensagens-preview";
import { PassoAPasso } from "./passo-a-passo";

export interface MetaCenario {
  nome: string;
  etapas: string[];
  canais: string[];
}

const VEREDITO: Record<AvaliacaoPlano["veredito"], { label: string; className: string }> = {
  recomendado: { label: "Recomendado", className: "border-transparent bg-accent text-accent-foreground" },
  viavel: { label: "Viável", className: "border-transparent bg-info-soft text-info" },
  arriscado: { label: "Precisa de atenção", className: "border-transparent bg-amber-soft text-amber" },
  inviavel: { label: "Não recomendado", className: "border-transparent bg-destructive-soft text-destructive" },
};

const numero = (n: number) => n.toLocaleString("pt-BR");

function Metrica({ icon: Icon, rotulo, valor, detalhe }: { icon: typeof Coins; rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-secondary/20 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" /> {rotulo}</span>
      <span className="text-lg font-semibold tabular-nums text-foreground">{valor}</span>
      {detalhe && <span className="text-xs text-muted-2">{detalhe}</span>}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function DetalhePlano({
  plano, meta, principal, aplicacao, onAplicacao,
}: {
  plano: PlanoOnboarding;
  meta: MetaCenario;
  principal: boolean;
  aplicacao: AplicacaoRow | null;
  onAplicacao: (a: AplicacaoRow) => void;
}) {
  const e = plano.estimativa;
  const pct = Math.min(999, Math.round(e.percentualOrcamento * 100));
  const av = plano.avaliacao;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-7">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{plano.letra}</span>
            {principal && <Badge className="gap-1"><Star className="h-3 w-3" /> Por onde começar</Badge>}
            {av && <Badge className={VEREDITO[av.veredito].className}>{VEREDITO[av.veredito].label}</Badge>}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{plano.titulo}</h2>
          <p className="text-sm text-muted-foreground">{meta.nome}</p>
        </header>

        <Secao titulo="Por que esta sugestão">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">{plano.porQue}</p>
        </Secao>

        <Secao titulo="Como funciona">
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Etapas da automação">
            {meta.etapas.map((etapa, i) => (
              <li key={etapa} className="flex items-center gap-1.5">
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">{etapa}</span>
                {i < meta.etapas.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-2" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{plano.comoFunciona}</p>
        </Secao>

        <Secao titulo="Funil que vai ser criado">
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Etapas do funil">
            {etapasDoFunil(plano).map((etapa, i, todas) => (
              <li key={etapa} className="flex items-center gap-1.5">
                <span className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  i < ETAPAS_AUTOMATICAS.length ? "border-dashed border-border text-muted-foreground" : "border-border bg-card text-foreground",
                )}>{etapa}</span>
                {i < todas.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-2" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            As etapas tracejadas andam sozinhas: quem responde no WhatsApp ou LinkedIn sai da cadência e vai pra &quot;Respondeu&quot;. Daí em diante é conversa de gente, e você move o card.
          </p>
        </Secao>

        <Secao titulo="Mensagens">
          <MensagensPreview mensagens={plano.mensagens} />
          {(plano.problemasCopy ?? []).length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-amber/40 bg-amber-soft/40 p-3">
              <p className="text-xs font-semibold text-foreground">Vale ajustar no texto antes de dar play</p>
              <ul className="flex flex-col gap-1">
                {plano.problemasCopy!.map((p, i) => (
                  <li key={i} className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{p.onde}:</span> {p.problema}</li>
                ))}
              </ul>
            </div>
          )}
        </Secao>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 rounded-xl border border-border p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Target className="h-4 w-4 text-primary" /> Como saber se está funcionando</p>
            <p className="text-sm text-muted-foreground">{plano.metricaSucesso}</p>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl border border-border p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><RotateCcw className="h-4 w-4 text-primary" /> Quando testar outra sugestão</p>
            <p className="text-sm text-muted-foreground">{plano.quandoTrocar}</p>
          </div>
        </div>

        {(plano.riscos.length > 0 || plano.lacunas.length > 0 || plano.ajustesAutomaticos.length > 0) && (
          <Secao titulo="Fique de olho">
            <ul className="flex flex-col gap-2">
              {[...plano.lacunas, ...plano.riscos].map((r) => (
                <li key={r} className="flex gap-2 text-sm text-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" /> {r}</li>
              ))}
              {plano.ajustesAutomaticos.map((a) => (
                <li key={a} className="flex gap-2 text-sm text-muted-foreground"><Gauge className="mt-0.5 h-4 w-4 shrink-0 text-info" /> {a}</li>
              ))}
            </ul>
          </Secao>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <PassoAPasso
          key={plano.letra}
          letra={plano.letra}
          aplicacaoInicial={aplicacao}
          onAplicacao={onAplicacao}
          volume={e.leadsComportaHojeMes !== undefined
            ? { sugeridoMes: e.leadsAbordadosMes, hojeMes: e.leadsComportaHojeMes, planoRecomendado: e.planoRecomendado ?? null }
            : null}
        />

        <div className="grid grid-cols-2 gap-2">
          <Metrica
            icon={Users}
            rotulo="Leads por mês (sugerido)"
            valor={numero(e.leadsAbordadosMes)}
            detalhe={e.leadsComportaHojeMes !== undefined && e.leadsComportaHojeMes < e.leadsAbordadosMes
              ? `Cabem hoje: ${numero(e.leadsComportaHojeMes)}`
              : e.capacidadeCanalMes && e.leadsExtraidosMes > e.leadsAbordadosMes ? `${numero(e.leadsExtraidosMes)} encontrados` : "Cabe nos seus créditos"}
          />
          <Metrica icon={Coins} rotulo="Créditos por mês" valor={numero(e.creditosMes)} detalhe={`${numero(e.custoPorLead)} por lead`} />
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Dos seus créditos de hoje</span>
            <span className={cn("font-semibold tabular-nums", pct > 100 ? "text-destructive" : pct > 80 ? "text-amber" : "text-foreground")}>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", pct > 100 ? "bg-destructive" : pct > 80 ? "bg-amber" : "bg-primary")} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          {e.usaOpenai && <p className="text-xs text-muted-2">+ consumo na sua conta OpenAI (pesquisa por IA).</p>}
          {pct > 80 && e.planoRecomendado !== undefined && (
            <p className="text-xs text-muted-foreground">
              {e.planoRecomendado
                ? <>Pra rodar no volume sugerido, o plano <Link href="/creditos" className="font-semibold text-primary hover:underline">{e.planoRecomendado}</Link> comporta. Com o saldo de hoje, dá pra começar menor e subir depois.</>
                : <>Esse volume passa do maior plano. Dá pra combinar plano + pacotes de créditos, ou reduzir o volume na automação.</>}
            </p>
          )}
        </div>

        {av && (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><BadgeCheck className="h-4 w-4 text-primary" /> Avaliação do especialista</p>
              <span className="text-lg font-bold tabular-nums text-foreground">{av.nota.toFixed(1).replace(".", ",")}<span className="text-xs font-normal text-muted-2">/10</span></span>
            </div>
            {av.pontosFortes.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {av.pontosFortes.map((p) => <li key={p} className="flex gap-2 text-xs text-foreground"><ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {p}</li>)}
              </ul>
            )}
            {av.pontosDeAtencao.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {av.pontosDeAtencao.map((p) => <li key={p} className="flex gap-2 text-xs text-foreground"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" /> {p}</li>)}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

export function PlanosView({
  resultado,
  aplicacoesIniciais,
  metaCenarios,
  onEditarRespostas,
}: {
  resultado: ResultadoOnboarding;
  aplicacoesIniciais: AplicacaoRow[];
  metaCenarios: Record<string, MetaCenario>;
  onEditarRespostas: () => void;
}) {
  const router = useRouter();
  const confirmar = useConfirm();
  const [selecionada, setSelecionada] = useState(resultado.planoPrincipal);
  const [aplicacoes, setAplicacoes] = useState(aplicacoesIniciais);
  const [regerando, setRegerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const plano = resultado.planos.find((p) => p.letra === selecionada) ?? resultado.planos[0];
  const aplicacaoDe = (letra: string) => aplicacoes.find((a) => a.letra === letra) ?? null;

  async function gerarDeNovo() {
    if (!(await confirmar({
      title: "Montar novas sugestões?",
      description: "A IA monta sugestões novas a partir das suas respostas atuais. As que você já usou continuam na sua conta.",
    }))) return;
    setRegerando(true);
    setErro(null);
    const resp = await fetch("/api/onboarding/gerar", { method: "POST" });
    const data = await resp.json().catch(() => ({}));
    setRegerando(false);
    if (!resp.ok) {
      setErro(data.error || "Não foi possível gerar de novo.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> O que entendemos do seu negócio</p>
          <p className="text-[15px] leading-relaxed text-foreground">{resultado.diagnostico}</p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-accent/50 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-foreground"><BadgeCheck className="h-3.5 w-3.5" /> Recomendação</p>
          <p className="text-[15px] leading-relaxed text-foreground">{resultado.parecer}</p>
          <button type="button" onClick={() => setSelecionada(resultado.planoPrincipal)} className="mt-1 inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Ver a Sugestão {resultado.planoPrincipal} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Suas sugestões</h2>
            <p className="text-sm text-muted-foreground">Caminhos diferentes pra testar. Ordem sugerida: {resultado.ordemSugerida.join(" → ")}.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onEditarRespostas}><PencilLine className="h-3.5 w-3.5" /> Editar respostas</Button>
            <Button variant="outline" size="sm" onClick={gerarDeNovo} disabled={regerando}>
              {regerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Gerar de novo
            </Button>
          </div>
        </div>
        {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}

        <div role="tablist" aria-label="Sugestões" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {resultado.planos.map((p) => {
            const ativo = p.letra === plano.letra;
            const apl = aplicacaoDe(p.letra);
            return (
              <button
                key={p.letra}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setSelecionada(p.letra)}
                className={cn(
                  "flex cursor-pointer flex-col gap-2.5 rounded-2xl border p-4 text-left transition-all",
                  ativo ? "border-primary bg-card shadow-[0_0_0_1px_var(--accent),var(--elevation-md)]" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold", ativo ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")}>{p.letra}</span>
                  <div className="flex items-center gap-1.5">
                    {p.letra === resultado.planoPrincipal && <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Por onde começar" />}
                    {p.avaliacao && <span className="text-xs font-semibold tabular-nums text-muted-foreground">{p.avaliacao.nota.toFixed(1).replace(".", ",")}</span>}
                  </div>
                </div>
                {p.estimativa.perfil && (
                  <span className={cn(
                    "w-fit rounded-full px-2 py-0.5 text-[11px] font-medium",
                    p.estimativa.perfil === "qualificada" ? "bg-info-soft text-info" : p.estimativa.perfil === "base" ? "bg-amber-soft text-amber" : "bg-accent text-accent-foreground",
                  )}>
                    {p.estimativa.perfil === "qualificada" ? "Mais qualificada" : p.estimativa.perfil === "base" ? "Sua base" : "Mais volume"}
                  </span>
                )}
                <p className="line-clamp-2 text-sm font-semibold text-foreground">{p.titulo}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {numero(p.estimativa.leadsAbordadosMes)}/mês</span>
                  <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" /> {numero(p.estimativa.creditosMes)}</span>
                </div>
                {apl && (
                  <Badge variant={apl.status === "ativo" ? "success" : "outline"} className="w-fit">
                    {apl.status === "ativo" ? "Rodando" : apl.status === "pausado" ? "Pausado" : "Em configuração"}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" className="rounded-2xl border border-border bg-card/40 p-5 sm:p-7">
        <DetalhePlano
          key={plano.letra}
          plano={plano}
          meta={metaCenarios[plano.cenarioId]}
          principal={plano.letra === resultado.planoPrincipal}
          aplicacao={aplicacaoDe(plano.letra)}
          onAplicacao={(a) => setAplicacoes((prev) => [...prev.filter((x) => x.letra !== a.letra), a])}
        />
      </div>
    </div>
  );
}
