"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FunilResumo { id: string; nome: string }
interface ColunaResumo { id: string; nome: string }

export function AdicionarAoFunilButton({ searchId }: { searchId: string }) {
  const [open, setOpen] = useState(false);
  const [funis, setFunis] = useState<FunilResumo[] | null>(null);
  const [funilId, setFunilId] = useState("");
  const [colunas, setColunas] = useState<ColunaResumo[]>([]);
  const [colunaId, setColunaId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    if (!open || funis !== null) return;
    fetch("/api/funis").then((r) => r.json()).then((d) => setFunis(d.funis || [])).catch(() => setFunis([]));
  }, [open, funis]);

  useEffect(() => {
    if (!funilId) return;
    fetch(`/api/funis/${funilId}`).then((r) => r.json()).then((d) => setColunas(d.colunas || [])).catch(() => setColunas([]));
  }, [funilId]);

  function escolherFunil(novoFunilId: string) {
    setFunilId(novoFunilId);
    setColunaId("");
  }

  async function confirmar() {
    if (!funilId || !colunaId) return;
    setEnviando(true);
    setResultado(null);
    const resp = await fetch(`/api/funis/${funilId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colunaId, searchId }),
    });
    const data = await resp.json();
    setEnviando(false);
    if (!resp.ok) return setResultado(data.error || "Não foi possível adicionar ao funil.");
    setResultado(`${data.total} lead(s) adicionado(s) ao funil.`);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Kanban className="h-4 w-4" /> Adicionar ao Funil
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary/40 p-3">
      {funis !== null && funis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem nenhum funil. <Link href="/funil" className="text-primary hover:underline">Criar um funil</Link>.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={funilId} onValueChange={escolherFunil}>
              <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Funil" /></SelectTrigger>
              <SelectContent>
                {(funis || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={colunaId} onValueChange={setColunaId} disabled={!funilId}>
              <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Coluna" /></SelectTrigger>
              <SelectContent>
                {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!colunaId || enviando} onClick={confirmar}>
              {enviando ? "Adicionando…" : "Confirmar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
          {resultado && (
            <Alert><AlertDescription>{resultado}</AlertDescription></Alert>
          )}
        </>
      )}
    </div>
  );
}
