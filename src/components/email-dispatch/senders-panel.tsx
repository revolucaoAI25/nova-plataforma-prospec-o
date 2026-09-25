"use client";

import { useState } from "react";
import { Plus, Trash2, Mail } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EmailSenderRow } from "@/lib/database.types";

export function SendersPanel({ sendersIniciais }: { sendersIniciais: EmailSenderRow[] }) {
  const [senders, setSenders] = useState(sendersIniciais);
  const [nome, setNome] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [limiteDiarioEnvios, setLimiteDiarioEnvios] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !fromName.trim() || !fromEmail.trim()) return;
    setCreating(true);
    setError(null);
    const resp = await fetch("/api/email-dispatch/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome, fromName, fromEmail, replyTo: replyTo || undefined,
        limiteDiarioEnvios: limiteDiarioEnvios.trim() ? Number(limiteDiarioEnvios) : undefined,
      }),
    });
    const data = await resp.json();
    setCreating(false);
    if (!resp.ok) {
      setError(data.error || "Não foi possível criar o remetente.");
      return;
    }
    setNome("");
    setFromName("");
    setFromEmail("");
    setReplyTo("");
    setLimiteDiarioEnvios("");
    const listResp = await fetch("/api/email-dispatch/senders");
    const listData = await listResp.json();
    setSenders(listData.senders || []);
  }

  async function remover(id: string) {
    if (!confirm("Remover este remetente?")) return;
    await fetch(`/api/email-dispatch/senders/${id}`, { method: "DELETE" });
    setSenders((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-primary" /> Remetentes</CardTitle>
        <CardDescription>
          Endereços usados para enviar campanhas via Resend — o domínio de cada e-mail precisa estar verificado no
          dashboard da Resend antes do primeiro envio.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {senders.length === 0 && <EmptyState icon={Mail} title="Nenhum remetente cadastrado ainda" className="py-8" />}

        {senders.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <span className="font-medium">{s.nome}</span>{" "}
              <span className="ml-1 text-sm text-muted-foreground">{s.from_name} &lt;{s.from_email}&gt;</span>
              {s.limite_diario_envios && (
                <Badge variant="outline" className="ml-2">Limite: {s.limite_diario_envios}/dia</Badge>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => remover(s.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}

        <form onSubmit={criar} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sender-nome">Nome interno</Label>
              <Input id="sender-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Vendas" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sender-from-name">Nome do remetente</Label>
              <Input id="sender-from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Ex: Equipe Vendas" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sender-from-email">E-mail do remetente</Label>
              <Input id="sender-from-email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="vendas@seudominio.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sender-reply-to">Responder para (opcional)</Label>
              <Input id="sender-reply-to" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="contato@seudominio.com" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-56">
            <Label htmlFor="sender-limite">Limite diário (opcional)</Label>
            <Input id="sender-limite" type="number" min={1} value={limiteDiarioEnvios} onChange={(e) => setLimiteDiarioEnvios(e.target.value)} placeholder="Sem limite" />
          </div>
          <Button type="submit" disabled={creating} className="self-start">
            <Plus className="h-4 w-4" /> {creating ? "Criando…" : "Novo remetente"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
