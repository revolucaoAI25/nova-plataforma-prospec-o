"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, Circle, Kanban, Loader2, Pause, Play, RefreshCw, Rocket, Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { AplicacaoRow, PassoChecklist } from "@/lib/onboarding/aplicar";

export interface VolumeOpcoes {
  sugeridoMes: number;
  hojeMes: number;
  planoRecomendado: string | null;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function PassoAPasso({
  letra,
  aplicacaoInicial,
  onAplicacao,
  volume,
}: {
  letra: string;
  aplicacaoInicial: AplicacaoRow | null;
  onAplicacao: (a: AplicacaoRow) => void;
  /** Quando os créditos de hoje não pagam o volume sugerido, o cliente escolhe com qual começar. */
  volume?: VolumeOpcoes | null;
}) {
  const [aplicacao, setAplicacao] = useState(aplicacaoInicial);
  const escolhaVolume = volume && volume.hojeMes < volume.sugeridoMes * 0.9 ? volume : null;
  const [volumeInicial, setVolumeInicial] = useState<"atual" | "sugerido">(escolhaVolume ? "atual" : "sugerido");
  const [passos, setPassos] = useState<PassoChecklist[] | null>(null);
  const [acao, setAcao] = useState<"aplicar" | "ativar" | "pausar" | "atualizar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    const resp = await fetch(`/api/onboarding/planos/${letra}`, { cache: "no-store" }).catch(() => null);
    if (!resp?.ok) return null;
    return (await resp.json()) as { passos: PassoChecklist[]; aplicacao: AplicacaoRow | null };
  }, [letra]);

  const aplicarResposta = useCallback((data: Awaited<ReturnType<typeof buscar>>) => {
    if (!data) return;
    setPassos(data.passos);
    if (data.aplicacao) setAplicacao(data.aplicacao);
  }, []);

  async function conferir() {
    setAcao("atualizar");
    aplicarResposta(await buscar());
    setAcao(null);
  }

  // O componente é remontado (key) a cada troca de plano, então só precisa
  // buscar o checklist uma vez — e de novo quando o cliente volta pra aba
  // depois de conectar um canal em outra tela.
  const temAplicacao = aplicacao !== null;
  useEffect(() => {
    if (!temAplicacao) return;
    let ativo = true;
    const carregar = () => void buscar().then((d) => ativo && aplicarResposta(d));
    carregar();
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [temAplicacao, buscar, aplicarResposta]);

  async function executar(tipo: "aplicar" | "ativar" | "pausar") {
    setAcao(tipo);
    setErro(null);
    const resp = await fetch(`/api/onboarding/planos/${letra}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tipo === "aplicar" ? { acao: tipo, volume: volumeInicial } : { acao: tipo }),
    });
    const data = await resp.json().catch(() => ({}));
    setAcao(null);
    if (!resp.ok) {
      setErro(data.error || "Não foi possível concluir.");
      return;
    }
    setPassos(data.passos);
    if (data.aplicacao) {
      setAplicacao(data.aplicacao);
      onAplicacao(data.aplicacao);
    }
  }

  if (!aplicacao) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-accent/60 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Rocket className="h-4 w-4 text-primary" /> Pronto pra usar
        </div>
        <p className="text-sm text-muted-foreground">
          Criamos na sua conta o funil, a campanha com estas mensagens e a automação — tudo pausado. Depois é só seguir o passo a passo e dar play.
        </p>
        {escolhaVolume && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold text-foreground">Com qual volume começar?</legend>
            {([
              ["atual", `Com o que cabe hoje: ~${fmt(escolhaVolume.hojeMes)} leads/mês`, "Usa os créditos que você já tem. Dá pra aumentar depois na automação."],
              ["sugerido", `Volume sugerido: ~${fmt(escolhaVolume.sugeridoMes)} leads/mês`, escolhaVolume.planoRecomendado ? `Pede o plano ${escolhaVolume.planoRecomendado} (ou créditos avulsos).` : "Pede mais créditos do que você tem hoje."],
            ] as const).map(([valor, titulo, ajuda]) => (
              <label
                key={valor}
                className={cn(
                  "flex cursor-pointer gap-2.5 rounded-xl border bg-card px-3 py-2.5 transition-colors",
                  volumeInicial === valor ? "border-primary" : "border-border hover:border-primary/40",
                )}
              >
                <input
                  type="radio" name={`volume-${letra}`} value={valor} checked={volumeInicial === valor}
                  onChange={() => setVolumeInicial(valor)} className="mt-1 accent-[var(--primary)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{titulo}</span>
                  <span className="text-xs text-muted-foreground">{ajuda}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
        <Button onClick={() => executar("aplicar")} disabled={acao !== null} className="self-start">
          {acao === "aplicar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Usar esta sugestão
        </Button>
      </div>
    );
  }

  const obrigatorios = (passos ?? []).filter((p) => p.obrigatorio);
  const feitos = obrigatorios.filter((p) => p.feito).length;
  const prontoPraPlay = passos !== null && feitos === obrigatorios.length;
  const ativo = aplicacao.status === "ativo";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{ativo ? "Rodando" : "Passo a passo"}</p>
        <Button variant="ghost" size="icon" onClick={conferir} disabled={acao !== null} aria-label="Conferir de novo">
          <RefreshCw className={cn("h-4 w-4", acao === "atualizar" && "animate-spin")} />
        </Button>
      </div>

      {ativo ? (
        <div className="flex items-center gap-3 rounded-xl bg-accent px-4 py-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <p className="text-sm text-accent-foreground">Buscando e abordando leads no horário programado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Progress value={obrigatorios.length ? (feitos / obrigatorios.length) * 100 : 100} />
          <p className="text-xs text-muted-foreground">
            {passos === null ? "Conferindo…" : `${feitos} de ${obrigatorios.length} passos obrigatórios concluídos`}
          </p>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {(passos ?? []).map((p) => (
          <li key={p.id} className={cn("flex gap-3 rounded-xl border px-3.5 py-3", p.feito ? "border-border bg-secondary/30" : "border-border bg-card")}>
            {p.feito ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-2" />}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className={cn("text-sm font-medium", p.feito ? "text-muted-foreground" : "text-foreground")}>
                {p.titulo}
                {!p.obrigatorio && <span className="ml-1.5 text-xs font-normal text-muted-2">(recomendado)</span>}
              </p>
              {!p.feito && <p className="text-xs text-muted-foreground">{p.descricao}</p>}
              {!p.feito && (
                <Link href={p.href} className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  {p.acao} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}

      {ativo ? (
        <div className="flex flex-wrap gap-2">
          {aplicacao.flow_id && (
            <Button asChild variant="outline" size="sm"><Link href={`/automacoes/fluxos/${aplicacao.flow_id}`}><Workflow className="h-3.5 w-3.5" /> Automação</Link></Button>
          )}
          {aplicacao.funil_id && (
            <Button asChild variant="outline" size="sm"><Link href={`/funil/${aplicacao.funil_id}`}><Kanban className="h-3.5 w-3.5" /> Funil</Link></Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => executar("pausar")} disabled={acao !== null}>
            {acao === "pausar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} Pausar
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={() => executar("ativar")} disabled={!prontoPraPlay || acao !== null} className="w-full">
          {acao === "ativar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {prontoPraPlay ? "Dar play" : "Conclua os passos pra dar play"}
        </Button>
      )}
    </div>
  );
}
