import { Gauge } from "lucide-react";
import { chaveApify } from "@/lib/platform-keys";
import { obterUsoApify, type UsoProvedor } from "@/lib/integrations/apify-uso";
import { cn } from "@/lib/utils";

const usd = (v: number) => `US$ ${v.toFixed(2).replace(".", ",")}`;

/** Consumo do mês no Apify (buscas de Maps, Instagram e LinkedIn), no painel do admin. */
export async function UsoBuscas() {
  const token = await chaveApify();
  if (!token) return null;
  let uso: UsoProvedor | null = null;
  try {
    uso = await obterUsoApify(token);
  } catch {
    uso = null;
  }

  const pct = uso ? Math.min(100, (uso.usadoUsd / uso.limiteUsd) * 100) : 0;
  const cor = pct >= 95 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";
  const fim = uso?.cicloFim ? new Date(uso.cicloFim).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Gauge className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">Consumo das buscas no Apify (Maps, Instagram, LinkedIn)</h2>
          <p className="text-xs text-muted-foreground">
            {uso
              ? `${usd(uso.usadoUsd)} de ${usd(uso.limiteUsd)} neste ciclo${fim ? `, que vai até ${fim}` : ""}. Aviso por e-mail e aqui em 60%, 80% e 95%.`
              : "Não foi possível consultar o consumo agora."}
          </p>
        </div>
        {uso && <span className="text-lg font-bold tabular-nums text-foreground">{Math.round(pct)}%</span>}
      </div>
      {uso && (
        <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Consumo do mês">
          <div className={cn("h-full rounded-full transition-all", cor)} style={{ width: `${pct}%` }} />
        </div>
      )}
    </section>
  );
}
