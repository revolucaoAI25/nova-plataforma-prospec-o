"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Cloud, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { SIGLAS_ESTADOS } from "@/lib/data/estados";
import {
  ETAPAS_QUESTIONARIO, perguntaVisivel, type Pergunta, type RespostasOnboarding,
} from "@/lib/onboarding/questionario";

export type Valor = string | string[] | undefined;

export function respondida(v: Valor): boolean {
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim().length > 0;
}

export function CampoPergunta({
  p, valor, erro, onChange,
}: {
  p: Pergunta;
  valor: Valor;
  erro: boolean;
  onChange: (v: Valor) => void;
}) {
  const id = `q-${p.id}`;
  const cabecalho = (
    <div className="flex flex-col gap-0.5">
      <Label htmlFor={id} className="text-sm font-semibold text-foreground">
        {p.label} {p.obrigatoria && <span className="text-primary" aria-hidden>*</span>}
      </Label>
      {p.ajuda && <p className="text-xs text-muted-foreground">{p.ajuda}</p>}
    </div>
  );

  if (p.tipo === "opcao") {
    return (
      <fieldset className="flex flex-col gap-2.5">
        <legend className="contents">{cabecalho}</legend>
        <div role="radiogroup" aria-labelledby={id} className="grid gap-2 sm:grid-cols-2">
          {p.opcoes!.map((o) => {
            const ativo = valor === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => onChange(o.valor)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                  ativo ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40",
                  erro && !valor && "border-destructive/50",
                )}
              >
                <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", ativo ? "border-primary bg-primary" : "border-border-strong")}>
                  {ativo && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{o.label}</span>
                  {o.ajuda && <span className="text-xs text-muted-foreground">{o.ajuda}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (p.tipo === "multi" || p.tipo === "ufs") {
    const selecionados = Array.isArray(valor) ? valor : [];
    const opcoes = p.tipo === "ufs" ? SIGLAS_ESTADOS.map((uf) => ({ valor: uf, label: uf })) : p.opcoes!;
    const alternar = (v: string) =>
      onChange(selecionados.includes(v) ? selecionados.filter((x) => x !== v) : [...selecionados, v]);
    return (
      <fieldset className="flex flex-col gap-2.5">
        <legend className="contents">{cabecalho}</legend>
        <div className={cn("flex flex-wrap gap-2", p.tipo === "ufs" && "grid grid-cols-6 sm:grid-cols-9")}>
          {opcoes.map((o) => {
            const ativo = selecionados.includes(o.valor);
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternar(o.valor)}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                  ativo ? "border-primary bg-accent font-medium text-accent-foreground" : "border-border bg-card text-foreground hover:border-primary/40",
                )}
              >
                {ativo && p.tipo !== "ufs" && <Check className="h-3.5 w-3.5" />}
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const texto = typeof valor === "string" ? valor : "";
  return (
    <div className="flex flex-col gap-2">
      {cabecalho}
      {p.tipo === "textarea" ? (
        <Textarea id={id} rows={3} value={texto} placeholder={p.placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={erro && !texto} />
      ) : (
        <Input
          id={id}
          type={p.tipo === "numero" ? "number" : "text"}
          inputMode={p.tipo === "numero" ? "numeric" : undefined}
          min={p.tipo === "numero" ? 0 : undefined}
          value={texto}
          placeholder={p.placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={erro && !texto}
        />
      )}
    </div>
  );
}

export function QuestionarioWizard({
  respostasIniciais,
  onGerando,
}: {
  respostasIniciais: RespostasOnboarding;
  onGerando: () => void;
}) {
  const [respostas, setRespostas] = useState<RespostasOnboarding>(respostasIniciais);
  const [etapa, setEtapa] = useState(0);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvando, setSalvando] = useState<"idle" | "salvando" | "salvo" | "erro">("idle");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const topoRef = useRef<HTMLDivElement>(null);
  const ultimoSalvo = useRef(JSON.stringify(respostasIniciais));

  const atual = ETAPAS_QUESTIONARIO[etapa];
  const ultima = etapa === ETAPAS_QUESTIONARIO.length - 1;
  const visiveis = useMemo(() => atual.perguntas.filter((p) => perguntaVisivel(p, respostas)), [atual, respostas]);
  const faltando = visiveis.filter((p) => p.obrigatoria && !respondida(respostas[p.id]));

  async function salvar(dados: RespostasOnboarding): Promise<boolean> {
    ultimoSalvo.current = JSON.stringify(dados);
    setSalvando("salvando");
    const resp = await fetch("/api/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respostas: dados }),
    }).catch(() => null);
    setSalvando(resp?.ok ? "salvo" : "erro");
    return Boolean(resp?.ok);
  }

  // Autosave: o cliente pode fechar a aba no meio e voltar depois.
  useEffect(() => {
    if (JSON.stringify(respostas) === ultimoSalvo.current) return;
    const t = setTimeout(() => void salvar(respostas), 800);
    return () => clearTimeout(t);
  }, [respostas]);

  function definir(id: keyof RespostasOnboarding, v: Valor) {
    setRespostas((prev) => ({ ...prev, [id]: v }));
  }

  function irPara(i: number) {
    setEtapa(i);
    setMostrarErros(false);
    topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function avancar() {
    if (faltando.length) {
      setMostrarErros(true);
      return;
    }
    if (!ultima) return irPara(etapa + 1);

    setGerando(true);
    setErro(null);
    if (!(await salvar(respostas))) {
      setGerando(false);
      setErro("Não foi possível salvar suas respostas. Verifique a conexão e tente de novo.");
      return;
    }
    const resp = await fetch("/api/onboarding/gerar", { method: "POST" });
    const data = await resp.json().catch(() => ({}));
    setGerando(false);
    if (!resp.ok) {
      setErro(data.error || "Não foi possível iniciar a montagem das sugestões.");
      return;
    }
    onGerando();
  }

  return (
    <div ref={topoRef} className="mx-auto flex w-full max-w-3xl scroll-mt-24 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Etapa {etapa + 1} de {ETAPAS_QUESTIONARIO.length}</span>
          <span className="inline-flex items-center gap-1" aria-live="polite">
            {salvando === "salvando" && <><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</>}
            {salvando === "salvo" && <><Cloud className="h-3 w-3" /> Respostas salvas</>}
            {salvando === "erro" && <span className="text-destructive">Não foi possível salvar</span>}
          </span>
        </div>
        <Progress value={((etapa + 1) / ETAPAS_QUESTIONARIO.length) * 100} />
        <nav aria-label="Etapas do questionário" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {ETAPAS_QUESTIONARIO.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => i < etapa && irPara(i)}
              disabled={i > etapa}
              aria-current={i === etapa ? "step" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                i === etapa && "bg-primary text-primary-foreground",
                i < etapa && "cursor-pointer bg-accent text-accent-foreground hover:bg-accent/80",
                i > etapa && "text-muted-2",
              )}
            >
              {i < etapa && <Check className="mr-1 inline h-3 w-3" />}
              {e.titulo}
            </button>
          ))}
        </nav>
      </div>

      <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--elevation-sm)] sm:p-7">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{atual.titulo}</h2>
          <p className="text-sm text-muted-foreground">{atual.descricao}</p>
        </header>

        {visiveis.map((p) => (
          <CampoPergunta
            key={p.id}
            p={p}
            valor={respostas[p.id] as Valor}
            erro={mostrarErros && Boolean(p.obrigatoria)}
            onChange={(v) => definir(p.id, v)}
          />
        ))}

        {mostrarErros && faltando.length > 0 && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>Responda {faltando.length === 1 ? "a pergunta marcada" : `as ${faltando.length} perguntas marcadas`} com * pra continuar.</AlertDescription>
          </Alert>
        )}
        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          <Button type="button" variant="ghost" onClick={() => irPara(etapa - 1)} disabled={etapa === 0 || gerando}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button type="button" onClick={avancar} disabled={gerando} size={ultima ? "lg" : "default"}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : ultima ? <Sparkles className="h-4 w-4" /> : null}
            {ultima ? "Ver minhas sugestões" : "Continuar"}
            {!ultima && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </section>
    </div>
  );
}
