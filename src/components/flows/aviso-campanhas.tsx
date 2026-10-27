"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FlowNode } from "@/lib/database.types";
import { CAMPANHA_DO_NO, problemasDaCampanha, type CampanhaResumo } from "./resumo-campanha";

interface Item {
  id: string;
  tipo: FlowNode["tipo"];
  nome: string;
  problemas: string[];
}

/**
 * No topo do editor: as campanhas usadas pelos módulos de disparo que não
 * vão enviar nada (parada, sem número, sem remetente, sem conta). A
 * automação inscreve os leads mesmo assim, então sem este aviso parece que
 * "não funcionou".
 */
export function AvisoCampanhas({ nodes }: { nodes: FlowNode[] }) {
  const usados = nodes
    .map((n) => ({ tipo: n.tipo, id: String((n.config as { campaignId?: unknown } | null)?.campaignId ?? "") }))
    .filter((u) => u.id && CAMPANHA_DO_NO[u.tipo]);
  const chave = [...new Set(usados.map((u) => `${u.tipo}:${u.id}`))].sort().join(",");
  const [itens, setItens] = useState<Item[]>([]);
  const [ativando, setAtivando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const pares = chave ? chave.split(",").map((p) => p.split(":") as [FlowNode["tipo"], string]) : [];
    Promise.all(
      pares.map(async ([tipo, id]) => {
        const resp = await fetch(`${CAMPANHA_DO_NO[tipo]!.api}/${id}`).catch(() => null);
        const d = resp?.ok ? await resp.json().catch(() => null) : null;
        const c = (d?.campanha ?? null) as CampanhaResumo | null;
        return c ? { id, tipo, nome: c.nome ?? "Campanha", problemas: problemasDaCampanha(tipo, c) } : null;
      }),
    ).then((r) => vivo && setItens(r.filter((x): x is Item => Boolean(x && x.problemas.length))));
    return () => { vivo = false; };
  }, [chave]);

  if (!itens.length) return null;

  async function ativar(item: Item) {
    setAtivando(item.id);
    setErro(null);
    const resp = await fetch(`${CAMPANHA_DO_NO[item.tipo]!.api}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ativa" }),
    }).catch(() => null);
    const j = await resp?.json().catch(() => null);
    setAtivando(null);
    if (!resp?.ok) return setErro(j?.error ?? `Não foi possível ativar "${item.nome}". Abra a campanha para conferir.`);
    setItens((lista) => lista.map((i) => (i.id === item.id ? { ...i, problemas: i.problemas.filter((p) => p.startsWith("não tem")) } : i)).filter((i) => i.problemas.length));
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground" role="status">
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        {itens.length === 1 ? "Uma campanha desta automação não vai enviar nada ainda" : "Algumas campanhas desta automação não vão enviar nada ainda"}
      </p>
      <p className="text-xs text-muted-foreground">
        A automação inscreve os leads mesmo assim; eles ficam esperando, sem erro, e recebem assim que a campanha estiver pronta.
      </p>
      <ul className="flex flex-col gap-1.5">
        {itens.map((i) => {
          const parada = i.problemas.some((p) => !p.startsWith("não tem"));
          const pagina = CAMPANHA_DO_NO[i.tipo]!.pagina;
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="min-w-0 flex-1">
                <strong className="text-foreground">{i.nome}</strong> {i.problemas.join(" e ")}.
              </span>
              {parada && !i.problemas.includes("está concluída") && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => ativar(i)} disabled={ativando !== null}>
                  {ativando === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Ativar
                </Button>
              )}
              <a href={`${pagina}/${i.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                abrir campanha <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          );
        })}
      </ul>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
