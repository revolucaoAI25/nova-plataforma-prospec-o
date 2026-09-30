"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicoSugerido } from "@/lib/onboarding/ia";

const PORTES: Record<string, string> = { "01": "ME", "03": "EPP", "05": "Médio/grande" };

/** Chips curtos com o que o público filtra — só o que está preenchido. */
function chips(p: PublicoSugerido): string[] {
  const f = p.parametros;
  const lista = (itens: string[], plural: string) =>
    !itens.length ? null : itens.length <= 2 ? itens.join(", ") : `${itens.length} ${plural}`;
  const resultado: (string | null)[] =
    p.fonte === "cnpj"
      ? [
          lista(f.cnaes, "CNAEs"),
          f.ufs.length ? (f.ufs.length > 3 ? `${f.ufs.length} estados` : f.ufs.join(", ")) : "Brasil todo",
          f.cidades.length ? lista(f.cidades, "cidades") : null,
          f.portes.length ? f.portes.map((x) => PORTES[x] ?? x).join(" + ") : null,
          f.mei === "excluir" ? "sem MEI" : null,
          f.idadeMinimaAnos ? `${f.idadeMinimaAnos}+ anos` : null,
          f.aberturaUltimosDias ? `abertas há ≤ ${f.aberturaUltimosDias} dias` : null,
          f.capitalMinimo ? `capital ≥ R$ ${f.capitalMinimo.toLocaleString("pt-BR")}` : null,
        ]
      : p.fonte === "maps"
        ? [f.nichoMaps || f.termoMaps, f.cidades.length ? lista(f.cidades, "cidades") : f.ufs.join(", ") || null]
        : p.fonte === "linkedin"
          ? [lista(f.cargosLinkedin, "cargos"), lista(f.localizacoesLinkedin, "locais"), f.palavraChaveLinkedin]
          : [f.perfilInstagram ? `seguidores de @${f.perfilInstagram}` : null];
  return resultado.filter((c): c is string => Boolean(c));
}

/**
 * Toggle discreto no topo das buscas avulsas: abre os públicos que a IA
 * sugeriu a partir do perfil do usuário e preenche o formulário com um
 * clique. Sem perfil, vira só um convite pra montar o perfil.
 */
export function SugestoesPublico({
  publicos,
  temPerfil,
  precisaAtualizar = false,
  onAplicar,
}: {
  publicos: PublicoSugerido[];
  temPerfil: boolean;
  precisaAtualizar?: boolean;
  onAplicar: (p: PublicoSugerido) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [aplicado, setAplicado] = useState<string | null>(null);

  if (!publicos.length) {
    if (precisaAtualizar) {
      return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <Link href="/perfil" className="font-medium text-primary hover:underline">Atualize suas sugestões</Link> pra receber públicos prontos pra esta busca.
        </p>
      );
    }
    if (temPerfil) return null;
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <Link href="/onboarding" className="font-medium text-primary hover:underline">Monte seu perfil</Link> e receba sugestões de público prontas pra esta busca.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-primary/30 bg-accent/60 px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:border-primary/60"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Sugestões pro seu público ({publicos.length})
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {publicos.map((p) => {
            const ativo = aplicado === p.nome;
            return (
              <div key={p.nome} className={cn("flex flex-col gap-2 rounded-xl border bg-card p-3.5", ativo ? "border-primary" : "border-border")}>
                <p className="text-sm font-semibold text-foreground">{p.nome}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{p.porQue}</p>
                <div className="flex flex-wrap gap-1">
                  {chips(p).map((c) => (
                    <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{c}</span>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={ativo ? "secondary" : "outline"}
                  className="mt-auto self-start"
                  onClick={() => { onAplicar(p); setAplicado(p.nome); }}
                >
                  {ativo ? <><Check className="h-3.5 w-3.5" /> Filtros preenchidos</> : "Usar este público"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
