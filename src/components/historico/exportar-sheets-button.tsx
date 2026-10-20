"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SheetConfig } from "@/lib/database.types";

type Config = { conectado: boolean; planilhas: SheetConfig[] };
type Modo = SheetConfig["modo"];

/**
 * Exporta para uma das planilhas configuradas em Conexões: os leads de uma
 * pesquisa (`searchId`) ou, com `destino`, outra rota que recebe o mesmo
 * pedido (resultado de um enriquecimento).
 */
export function ExportarSheetsButton({ searchId, destino, compacto = false }: { searchId?: string; destino?: string; compacto?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [planilhaId, setPlanilhaId] = useState<string>("");
  const [modo, setModo] = useState<Modo>("acrescentar");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  async function carregar() {
    setErroConfig(null);
    const resp = await fetch("/api/integrations/google-sheets/config").catch(() => null);
    const data = resp?.ok ? ((await resp.json().catch(() => null)) as Config | null) : null;
    if (!data) {
      setErroConfig("Não foi possível carregar as suas planilhas. Tente novamente.");
      return;
    }
    setConfig(data);
    const padrao = data.planilhas.find((p) => p.padrao) ?? data.planilhas[0];
    if (padrao) {
      setPlanilhaId(padrao.id);
      setModo(padrao.modo);
    }
  }

  function alternar(abrir: boolean) {
    setAberto(abrir);
    if (abrir) {
      setResultado(null);
      if (!config) void carregar();
    }
  }

  async function exportar() {
    const planilha = config?.planilhas.find((p) => p.id === planilhaId);
    if (!planilha) return;
    setEnviando(true);
    setResultado(null);
    const resp = await fetch(destino ?? `/api/export/${searchId}/sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetId: planilha.id, aba: planilha.aba, modo }),
    }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    setEnviando(false);
    if (!resp?.ok) {
      setResultado({ ok: false, msg: data?.error || "Não foi possível exportar agora. Tente novamente." });
      return;
    }
    setResultado({ ok: true, msg: `Exportado para "${planilha.nome}", aba ${planilha.aba}.` });
  }

  const planilhaAtual = config?.planilhas.find((p) => p.id === planilhaId);

  return (
    <Popover open={aberto} onOpenChange={alternar}>
      <PopoverTrigger asChild>
        {compacto ? (
          <Button variant="ghost" size="icon" title="Exportar para o Google Sheets" aria-label="Exportar para o Google Sheets">
            <Sheet className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Sheet className="h-4 w-4" /> Google Sheets
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-foreground">Exportar para o Google Sheets</p>

          {erroConfig && <p className="text-xs text-destructive">{erroConfig}</p>}

          {!config && !erroConfig && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando as suas planilhas…
            </p>
          )}

          {config && !config.conectado && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Conecte a sua conta Google em{" "}
              <Link href="/conexoes" className="font-medium text-primary hover:underline">Conexões</Link> para exportar.
            </p>
          )}

          {config?.conectado && config.planilhas.length === 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Nenhuma planilha adicionada ainda. Adicione uma em{" "}
              <Link href="/conexoes" className="font-medium text-primary hover:underline">Conexões</Link>.
            </p>
          )}

          {config?.conectado && config.planilhas.length > 0 && (
            <>
              <div className="flex flex-col gap-1" role="radiogroup" aria-label="Planilha">
                {config.planilhas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={p.id === planilhaId}
                    onClick={() => setPlanilhaId(p.id)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left",
                      p.id === planilhaId ? "border-primary/50 bg-accent" : "border-border hover:bg-secondary",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{p.nome}</span>
                      <span className="block text-xs text-muted-foreground">Aba {p.aba}</span>
                    </span>
                    {p.id === planilhaId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/40 p-1" role="radiogroup" aria-label="Como gravar">
                {([["acrescentar", "Acrescentar no fim"], ["substituir", "Substituir a aba"]] as const).map(([m, rotulo]) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={modo === m}
                    onClick={() => setModo(m)}
                    className={cn("rounded-lg px-2 py-1.5 text-xs font-medium", modo === m ? "bg-card text-foreground shadow-[var(--elevation-sm)]" : "text-muted-foreground")}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              {modo === "substituir" && (
                <p className="-mt-1 text-[11px] leading-snug text-muted-foreground">Apaga o que está na aba e grava só estes leads.</p>
              )}

              <Button size="sm" onClick={exportar} disabled={enviando || !planilhaAtual}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
                {enviando ? "Exportando…" : "Exportar"}
              </Button>
            </>
          )}

          {resultado && (
            <p className={cn("text-xs leading-relaxed", resultado.ok ? "text-primary" : "text-destructive")} role="status">
              {resultado.msg}
              {resultado.ok && planilhaAtual && (
                <>
                  {" "}
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${planilhaAtual.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                  >
                    Abrir planilha <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
