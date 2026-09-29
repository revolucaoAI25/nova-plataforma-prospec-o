"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, UserSearch, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { LinkedinAccountRow } from "@/lib/database.types";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "secondary" | "destructive" }> = {
  conectado: { label: "Conectado", variant: "success" },
  conectando: { label: "Conectando…", variant: "secondary" },
  desconectado: { label: "Desconectado", variant: "destructive" },
  requer_reconexao: { label: "Precisa reconectar", variant: "destructive" },
};

/** Enquanto a conta está `conectando`, faz polling simples do status — sem QR embutido (é a Unipile que mostra a tela de login numa aba própria). */
function usePollStatus(contaId: string, ativo: boolean, onAtualizado: (conta: LinkedinAccountRow) => void) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!ativo) return;
    pollRef.current = setInterval(async () => {
      const resp = await fetch(`/api/linkedin-dispatch/accounts/${contaId}`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.conta && data.conta.status !== "conectando") {
        if (pollRef.current) clearInterval(pollRef.current);
        onAtualizado(data.conta);
      }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaId, ativo]);
}

function ContaCard({ conta, onAtualizada, onRemover }: { conta: LinkedinAccountRow; onAtualizada: (c: LinkedinAccountRow) => void; onRemover: (id: string) => void }) {
  const [reconectando, setReconectando] = useState(false);
  usePollStatus(conta.id, conta.status === "conectando", onAtualizada);

  async function reconectar() {
    setReconectando(true);
    const resp = await fetch(`/api/linkedin-dispatch/accounts/${conta.id}/reconnect`, { method: "POST" });
    const data = await resp.json();
    setReconectando(false);
    if (resp.ok && data.url) window.open(data.url, "_blank");
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <div>
        <span className="font-medium">{conta.nome}</span>{" "}
        {conta.perfil_nome && <span className="ml-1 text-sm text-muted-foreground">{conta.perfil_nome}</span>}
        <Badge variant="outline" className="ml-2">
          Convites: {conta.limite_diario_convites}/dia · Mensagens: {conta.limite_diario_mensagens}/dia
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_LABEL[conta.status]?.variant ?? "secondary"}>{STATUS_LABEL[conta.status]?.label ?? conta.status}</Badge>
        {conta.status === "requer_reconexao" && (
          <Button type="button" variant="outline" size="sm" onClick={reconectar} disabled={reconectando}>
            <RefreshCw className="h-4 w-4" /> {reconectando ? "Gerando link…" : "Reconectar"}
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemover(conta.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export function AccountsPanel({ contasIniciais }: { contasIniciais: LinkedinAccountRow[] }) {
  const confirmar = useConfirm();
  const [contas, setContas] = useState(contasIniciais);
  const [nome, setNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setCreating(true);
    setError(null);
    const resp = await fetch("/api/linkedin-dispatch/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    const data = await resp.json();
    setCreating(false);
    if (!resp.ok) {
      setError(data.error || "Não foi possível criar a conta.");
      return;
    }
    setNome("");
    const listResp = await fetch("/api/linkedin-dispatch/accounts");
    const listData = await listResp.json();
    setContas(listData.contas || []);
    if (data.url) window.open(data.url, "_blank");
  }

  async function remover(id: string) {
    if (!(await confirmar({ title: "Remover esta conta?", destructive: true }))) return;
    await fetch(`/api/linkedin-dispatch/accounts/${id}`, { method: "DELETE" });
    setContas((prev) => prev.filter((c) => c.id !== id));
  }

  function atualizarConta(atualizada: LinkedinAccountRow) {
    setContas((prev) => prev.map((c) => (c.id === atualizada.id ? atualizada : c)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><UserSearch className="h-4 w-4 text-primary" /> Contas LinkedIn</CardTitle>
        <CardDescription>
          Cada conta é uma sessão real logada — o próprio LinkedIn da pessoa, não um número/API
          separado. Limites diários conservadores de propósito, pra reduzir risco de banimento.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {contas.length === 0 && <EmptyState icon={UserSearch} title="Nenhuma conta conectada ainda" className="py-8" />}

        {contas.map((c) => (
          <ContaCard key={c.id} conta={c} onAtualizada={atualizarConta} onRemover={remover} />
        ))}

        <form onSubmit={criar} className="flex gap-2">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da conta (ex: Vendas — João)" />
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4" /> {creating ? "Gerando link…" : "Conectar LinkedIn"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
