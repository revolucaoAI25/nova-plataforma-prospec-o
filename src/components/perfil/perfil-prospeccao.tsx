"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Coins, Compass, Loader2, Mail, Plug, RefreshCw, Save, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CampoPergunta, respondida, type Valor } from "@/components/onboarding/questionario-wizard";
import {
  ETAPAS_QUESTIONARIO, pendenciasParaGerar, perguntaVisivel, type RespostasOnboarding,
} from "@/lib/onboarding/questionario";
import type { OnboardingStatus } from "@/lib/onboarding/db";

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Perfil de prospecção editável: as mesmas perguntas do onboarding (fonte
 * única em questionario.ts), abertas de uma vez. Salvar não mexe nas
 * sugestões atuais; "atualizar sugestões" gera de novo com o perfil novo.
 */
export function PerfilProspeccao({
  email, nomePlano, creditos, status, geradoEm, respostasIniciais,
}: {
  email: string;
  nomePlano: string | null;
  creditos: number;
  status: OnboardingStatus | null;
  geradoEm: string | null;
  respostasIniciais: RespostasOnboarding;
}) {
  const router = useRouter();
  const [respostas, setRespostas] = useState<RespostasOnboarding>(respostasIniciais);
  const [salvas, setSalvas] = useState(() => JSON.stringify(respostasIniciais));
  const [acao, setAcao] = useState<"salvar" | "atualizar" | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string } | null>(null);
  const [mostrarErros, setMostrarErros] = useState(false);

  const alterado = JSON.stringify(respostas) !== salvas;
  const pendentes = useMemo(() => pendenciasParaGerar(respostas), [respostas]);
  const visiveis = ETAPAS_QUESTIONARIO.flatMap((e) => e.perguntas.filter((p) => perguntaVisivel(p, respostas)));
  const preenchidas = visiveis.filter((p) => respondida(respostas[p.id] as Valor)).length;
  const nuncaComecou = !status && !Object.keys(respostasIniciais).length;

  async function salvar(): Promise<boolean> {
    const resp = await fetch("/api/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respostas }),
    }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    if (!resp?.ok) {
      setAviso({ ok: false, msg: data?.error || "Não foi possível salvar. Verifique a conexão e tente de novo." });
      return false;
    }
    setSalvas(JSON.stringify(respostas));
    return true;
  }

  async function aoSalvar() {
    setAcao("salvar");
    setAviso(null);
    const ok = await salvar();
    setAcao(null);
    if (ok) setAviso({ ok: true, msg: geradoEm ? "Perfil salvo. As sugestões atuais continuam as mesmas até você atualizar." : "Perfil salvo." });
  }

  async function atualizarSugestoes() {
    if (pendentes.length) {
      setMostrarErros(true);
      setAviso({ ok: false, msg: `Faltam respostas obrigatórias: ${pendentes.map((p) => p.label).join("; ")}.` });
      return;
    }
    setAcao("atualizar");
    setAviso(null);
    if (alterado && !(await salvar())) return setAcao(null);
    const resp = await fetch("/api/onboarding/gerar", { method: "POST" }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    if (!resp?.ok) {
      setAcao(null);
      setAviso({ ok: false, msg: data?.error || "Não foi possível atualizar as sugestões agora." });
      return;
    }
    router.push("/onboarding");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Mail className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">E-mail de acesso</p>
            <p className="truncate text-sm font-semibold text-foreground">{email}</p>
          </div>
        </div>
        <Link href="/creditos" className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Coins className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{nomePlano ? `Assinatura ${nomePlano}` : "Sem assinatura ativa"}</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{creditos.toLocaleString("pt-BR")} créditos</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-2 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/conexoes" className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Plug className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Canais e integrações</p>
            <p className="text-sm font-semibold text-foreground">Conexões</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-2 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </section>

      {nuncaComecou ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-primary/40 bg-card p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary"><Compass className="h-6 w-6" /></span>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">Você ainda não montou seu perfil de prospecção</h2>
            <p className="text-sm text-muted-foreground">São 5 minutos de perguntas sobre o seu negócio. Com isso a IA monta sugestões de prospecção prontas e sugere públicos nas buscas.</p>
          </div>
          <Button asChild><Link href="/onboarding">Montar meu perfil <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary"><UserRound className="h-6 w-6" /></span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">Perfil de prospecção</h2>
                <span className="text-xs text-muted-foreground">
                  {geradoEm ? `Sugestões geradas em ${dataCurta(geradoEm)}` : "Sugestões ainda não geradas"}
                </span>
              </div>
              <Progress value={visiveis.length ? (preenchidas / visiveis.length) * 100 : 0} />
              <p className="text-xs text-muted-foreground">
                {preenchidas} de {visiveis.length} respostas preenchidas{pendentes.length ? ` · ${pendentes.length} obrigatória${pendentes.length > 1 ? "s" : ""} faltando` : ""}. Quanto mais completo, mais certeiras as sugestões e as mensagens.
              </p>
            </div>
            <Button variant="outline" onClick={atualizarSugestoes} disabled={acao !== null || status === "gerando"} className="shrink-0">
              {acao === "atualizar" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "gerando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {status === "gerando" ? "Gerando…" : geradoEm ? "Atualizar sugestões" : "Gerar sugestões"}
            </Button>
          </section>

          {ETAPAS_QUESTIONARIO.map((etapa) => {
            const perguntas = etapa.perguntas.filter((p) => perguntaVisivel(p, respostas));
            return (
              <section key={etapa.id} aria-labelledby={`perfil-${etapa.id}`} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
                <header className="flex flex-col gap-1">
                  <h2 id={`perfil-${etapa.id}`} className="text-base font-semibold text-foreground">{etapa.titulo}</h2>
                  <p className="text-sm text-muted-foreground">{etapa.descricao}</p>
                </header>
                {perguntas.map((p) => (
                  <CampoPergunta
                    key={p.id}
                    p={p}
                    valor={respostas[p.id] as Valor}
                    erro={mostrarErros && Boolean(p.obrigatoria)}
                    onChange={(v) => setRespostas((prev) => ({ ...prev, [p.id]: v }))}
                  />
                ))}
              </section>
            );
          })}

          {aviso && (
            <Alert variant={aviso.ok ? "success" : "destructive"} role={aviso.ok ? "status" : "alert"}>
              <AlertDescription>{aviso.msg}</AlertDescription>
            </Alert>
          )}

          <div className="sticky bottom-4 z-30 flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-[var(--elevation-lg)] backdrop-blur">
            <span className="px-1 text-sm text-muted-foreground">{alterado ? "Você tem alterações não salvas." : "Tudo salvo."}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" onClick={aoSalvar} disabled={!alterado || acao !== null}>
                {acao === "salvar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
              </Button>
              {geradoEm && (
                <Button onClick={atualizarSugestoes} disabled={acao !== null || status === "gerando"}>
                  {acao === "atualizar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {alterado ? "Salvar e atualizar sugestões" : "Atualizar sugestões"}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
