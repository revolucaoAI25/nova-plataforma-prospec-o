"use client";

import { useMemo, useState } from "react";
import { Plus, Settings2, Trash2, Zap, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FunilCardView } from "@/components/funil/funil-card";
import { AdicionarLeadsDialog } from "@/components/funil/adicionar-leads-dialog";
import type { FunilColunaRow, FunilCardRow, AutomationFlowRow } from "@/lib/database.types";

const SEM_FLUXO = "nenhum";

interface Props {
  funilId: string;
  colunasIniciais: FunilColunaRow[];
  cardsIniciais: FunilCardRow[];
  flows: Pick<AutomationFlowRow, "id" | "nome">[];
}

export function FunilBoard({ funilId, colunasIniciais, cardsIniciais, flows }: Props) {
  const [colunas, setColunas] = useState(colunasIniciais);
  const [cards, setCards] = useState(cardsIniciais);
  const [novaColuna, setNovaColuna] = useState("");
  const [colunaEditando, setColunaEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [colunaAdicionando, setColunaAdicionando] = useState<string | null>(null);

  const cardsPorColuna = useMemo(() => {
    const mapa = new Map<string, FunilCardRow[]>();
    for (const coluna of colunas) mapa.set(coluna.id, []);
    for (const card of cards) {
      const lista = mapa.get(card.coluna_id);
      if (lista) lista.push(card);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.ordem - b.ordem);
    return mapa;
  }, [colunas, cards]);

  function mostrarAviso(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 5000);
  }

  async function adicionarColuna() {
    if (!novaColuna.trim()) return;
    const resp = await fetch(`/api/funis/${funilId}/colunas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novaColuna.trim() }),
    });
    const data = await resp.json();
    if (!resp.ok) return mostrarAviso(data.error || "Não foi possível criar a coluna.");
    setColunas((prev) => [...prev, { id: data.id, funil_id: funilId, nome: novaColuna.trim(), ordem: prev.length, cor: null, fluxo_id: null, criado_em: new Date().toISOString() }]);
    setNovaColuna("");
  }

  async function atualizarColuna(colunaId: string, campos: { nome?: string; fluxoId?: string | null }) {
    const resp = await fetch(`/api/funis/${funilId}/colunas/${colunaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campos),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return mostrarAviso(data.error || "Não foi possível atualizar a coluna.");
    }
    setColunas((prev) => prev.map((c) => (c.id === colunaId ? {
      ...c,
      nome: campos.nome ?? c.nome,
      fluxo_id: campos.fluxoId !== undefined ? campos.fluxoId : c.fluxo_id,
    } : c)));
  }

  async function excluirColuna(colunaId: string) {
    if (!confirm("Excluir esta coluna? Os cards dentro dela também serão apagados.")) return;
    const resp = await fetch(`/api/funis/${funilId}/colunas/${colunaId}`, { method: "DELETE" });
    if (!resp.ok) return mostrarAviso("Não foi possível excluir a coluna.");
    setColunas((prev) => prev.filter((c) => c.id !== colunaId));
    setCards((prev) => prev.filter((c) => c.coluna_id !== colunaId));
    setColunaEditando(null);
  }

  async function recarregarCards() {
    const resp = await fetch(`/api/funis/${funilId}`);
    if (!resp.ok) return;
    const data = await resp.json();
    setCards(data.cards || []);
  }

  async function excluirCard(cardId: string) {
    const resp = await fetch(`/api/funis/${funilId}/cards/${cardId}`, { method: "DELETE" });
    if (!resp.ok) return mostrarAviso("Não foi possível remover o card.");
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  async function moverCard(cardId: string, novaColunaId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.coluna_id === novaColunaId) return;
    const ordem = (cardsPorColuna.get(novaColunaId) || []).length;

    // Otimista — a UI já reflete o novo lugar antes da resposta do servidor.
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, coluna_id: novaColunaId, ordem } : c)));

    const resp = await fetch(`/api/funis/${funilId}/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colunaId: novaColunaId, ordem }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, coluna_id: card.coluna_id, ordem: card.ordem } : c)));
      return mostrarAviso(data.error || "Não foi possível mover o card.");
    }
    if (data.fluxoDisparado) {
      const coluna = colunas.find((c) => c.id === novaColunaId);
      mostrarAviso(`Automação disparada pra esse lead (coluna "${coluna?.nome}").`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {colunaAdicionando && (
        <AdicionarLeadsDialog
          funilId={funilId}
          colunaId={colunaAdicionando}
          colunaNome={colunas.find((c) => c.id === colunaAdicionando)?.nome ?? ""}
          onAdicionado={recarregarCards}
          onFechar={() => setColunaAdicionando(null)}
        />
      )}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {colunas.map((coluna) => (
          <div key={coluna.id} className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="truncate text-sm font-semibold text-foreground">{coluna.nome}</span>
                {coluna.fluxo_id && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {(cardsPorColuna.get(coluna.id) || []).length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Adicionar leads nesta coluna"
                  onClick={() => setColunaAdicionando(colunaAdicionando === coluna.id ? null : coluna.id)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setColunaEditando(colunaEditando === coluna.id ? null : coluna.id)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {colunaEditando === coluna.id && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/50 p-2.5">
                <Input
                  className="h-8"
                  defaultValue={coluna.nome}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== coluna.nome && atualizarColuna(coluna.id, { nome: e.target.value.trim() })}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Disparar fluxo quando um card entrar aqui (arraste manual)</span>
                  <Select
                    value={coluna.fluxo_id || SEM_FLUXO}
                    onValueChange={(v) => atualizarColuna(coluna.id, { fluxoId: v === SEM_FLUXO ? null : v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_FLUXO}>Nenhum</SelectItem>
                      {flows.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="destructive" size="sm" onClick={() => excluirColuna(coluna.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir coluna
                </Button>
              </div>
            )}

            <div
              className="flex min-h-24 flex-col gap-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragCardId) moverCard(dragCardId, coluna.id);
                setDragCardId(null);
              }}
            >
              {(cardsPorColuna.get(coluna.id) || []).map((card) => (
                <FunilCardView
                  key={card.id}
                  card={card}
                  onDragStart={() => setDragCardId(card.id)}
                  onRemover={() => excluirCard(card.id)}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="flex w-72 shrink-0 flex-col gap-2 rounded-2xl border border-dashed border-border p-3">
          <Input
            placeholder="Nome da nova coluna"
            className="h-8"
            value={novaColuna}
            onChange={(e) => setNovaColuna(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarColuna()}
          />
          <Button variant="outline" size="sm" onClick={adicionarColuna} disabled={!novaColuna.trim()}>
            <Plus className="h-3.5 w-3.5" /> Adicionar coluna
          </Button>
        </div>
      </div>
    </div>
  );
}
