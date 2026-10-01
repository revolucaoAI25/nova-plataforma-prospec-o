"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, PencilLine, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// As etapas refletem a ordem real do pipeline (gerar → estimar → avaliar →
// revisar), mas o avanço visual é por tempo: o worker não expõe progresso
// fino, e isso basta pra mostrar que algo está acontecendo.
const ETAPAS = [
  { titulo: "Entendendo o seu negócio e o seu cliente ideal", segundos: 0 },
  { titulo: "Escolhendo os caminhos de prospecção que fazem sentido", segundos: 15 },
  { titulo: "Calculando volume pela sua meta e o custo de cada caminho", segundos: 40 },
  { titulo: "Uma segunda IA avaliando cada sugestão", segundos: 60 },
  { titulo: "Ajustando as sugestões e escrevendo as mensagens", segundos: 95 },
];

export function GerandoPlanos({ erroInicial, onEditar }: { erroInicial: string | null; onEditar: () => void }) {
  const router = useRouter();
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(erroInicial);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (erro) return;
    const relogio = setInterval(() => setSegundos((s) => s + 1), 1000);
    const consulta = setInterval(async () => {
      const resp = await fetch("/api/onboarding", { cache: "no-store" }).catch(() => null);
      if (!resp?.ok) return;
      const data = await resp.json();
      if (data.status === "pronto") router.refresh();
      else if (data.status === "erro") setErro(data.erro || "Não foi possível montar as sugestões.");
    }, 5000);
    return () => {
      clearInterval(relogio);
      clearInterval(consulta);
    };
  }, [erro, router]);

  async function tentarDeNovo() {
    setReenviando(true);
    const resp = await fetch("/api/onboarding/gerar", { method: "POST" });
    const data = await resp.json().catch(() => ({}));
    setReenviando(false);
    if (!resp.ok) {
      setErro(data.error || "Não foi possível tentar de novo.");
      return;
    }
    setSegundos(0);
    setErro(null);
  }

  if (erro) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold text-foreground">Não conseguimos montar suas sugestões agora</h2>
          <p className="text-sm text-muted-foreground">Suas respostas estão salvas. Tente de novo em instantes ou revise o que respondeu.</p>
        </div>
        <Alert variant="destructive" className="text-left"><AlertDescription>{erro}</AlertDescription></Alert>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={tentarDeNovo} disabled={reenviando}>
            {reenviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Tentar de novo
          </Button>
          <Button variant="outline" onClick={onEditar}><PencilLine className="h-4 w-4" /> Revisar respostas</Button>
        </div>
      </div>
    );
  }

  const atual = ETAPAS.reduce((idx, e, i) => (segundos >= e.segundos ? i : idx), 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-[var(--elevation-md)]">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/15 motion-reduce:animate-none" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary">
          <Sparkles className="h-8 w-8" />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Montando suas sugestões de prospecção</h2>
        <p className="text-sm text-muted-foreground">
          Costuma levar de 1 a 3 minutos. Pode sair desta tela — as sugestões ficam salvas aqui quando estiverem prontas.
        </p>
      </div>
      <ol className="flex w-full flex-col gap-2.5 text-left" aria-live="polite">
        {ETAPAS.map((e, i) => (
          <li key={e.titulo} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors", i === atual && "bg-accent")}>
            <span className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
              i < atual && "border-primary bg-primary text-primary-foreground",
              i === atual && "border-primary text-primary",
              i > atual && "border-border text-muted-2",
            )}>
              {i < atual ? <Check className="h-3.5 w-3.5" /> : i === atual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-[11px]">{i + 1}</span>}
            </span>
            <span className={cn(i > atual ? "text-muted-2" : "text-foreground", i === atual && "font-medium")}>{e.titulo}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs tabular-nums text-muted-2">{Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}</p>
    </div>
  );
}
