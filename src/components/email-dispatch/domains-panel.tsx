"use client";

import { useState } from "react";
import { Plus, Trash2, Globe, Copy, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { EmailDomainRow, EmailDomainStatus } from "@/lib/database.types";

const STATUS_LABEL: Record<EmailDomainStatus, string> = {
  not_started: "Não iniciado",
  pending: "Aguardando DNS",
  verified: "Verificado",
  failed: "Falhou",
};

function StatusBadge({ status }: { status: EmailDomainStatus }) {
  if (status === "verified") return <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> {STATUS_LABEL[status]}</Badge>;
  if (status === "failed") return <Badge variant="destructive"><XCircle className="h-3 w-3" /> {STATUS_LABEL[status]}</Badge>;
  if (status === "pending") return <Badge variant="outline"><Clock className="h-3 w-3" /> {STATUS_LABEL[status]}</Badge>;
  return <Badge variant="soft">{STATUS_LABEL[status]}</Badge>;
}

function copiar(texto: string) {
  navigator.clipboard?.writeText(texto).catch(() => {});
}

export function DomainsPanel({ dominiosIniciais }: { dominiosIniciais: EmailDomainRow[] }) {
  const confirmar = useConfirm();
  const [dominios, setDominios] = useState(dominiosIniciais);
  const [novoDominio, setNovoDominio] = useState("");
  const [creating, setCreating] = useState(false);
  const [verificandoId, setVerificandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoDominio.trim()) return;
    setCreating(true);
    setError(null);
    const resp = await fetch("/api/email-dispatch/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dominio: novoDominio.trim() }),
    });
    const data = await resp.json();
    setCreating(false);
    if (!resp.ok) {
      setError(data.error || "Não foi possível registrar o domínio.");
      return;
    }
    setNovoDominio("");
    setDominios((prev) => [data.domain as EmailDomainRow, ...prev]);
  }

  async function verificar(id: string) {
    setVerificandoId(id);
    setError(null);
    const resp = await fetch(`/api/email-dispatch/domains/${id}/verify`, { method: "POST" });
    const data = await resp.json();
    setVerificandoId(null);
    if (!resp.ok) {
      setError(data.error || "Não foi possível verificar o domínio.");
      return;
    }
    setDominios((prev) => prev.map((d) => (d.id === id ? (data.domain as EmailDomainRow) : d)));
  }

  async function remover(id: string) {
    if (!(await confirmar({ title: "Remover este domínio?", description: "Remetentes que usam ele deixarão de poder enviar.", destructive: true }))) return;
    await fetch(`/api/email-dispatch/domains/${id}`, { method: "DELETE" });
    setDominios((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4 text-primary" /> Domínios</CardTitle>
        <CardDescription>
          Verifique o domínio do qual você vai enviar e-mails. Adicione um domínio, copie os registros DNS abaixo pro
          provedor onde ele está registrado (ex: Registro.br, Wix, Cloudflare) e clique em &quot;Verificar&quot;
          depois que os registros propagarem — pode levar algumas horas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {dominios.length === 0 && <EmptyState icon={Globe} title="Nenhum domínio registrado ainda" className="py-8" />}

        {dominios.map((d) => (
          <div key={d.id} className="flex flex-col gap-3 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{d.dominio}</span>
                <StatusBadge status={d.status} />
              </div>
              <div className="flex items-center gap-1">
                {d.status !== "verified" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={verificandoId === d.id}
                    onClick={() => verificar(d.id)}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${verificandoId === d.id ? "animate-spin" : ""}`} />
                    {verificandoId === d.id ? "Verificando…" : "Verificar"}
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={() => remover(d.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {d.records.length > 0 && d.status !== "verified" && (
              <div className="overflow-x-auto rounded-lg border border-border-strong/60">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="bg-accent/50 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Tipo</th>
                      <th className="px-2 py-1.5 text-left font-medium">Nome</th>
                      <th className="px-2 py-1.5 text-left font-medium">Valor</th>
                      <th className="px-2 py-1.5 text-left font-medium">TTL</th>
                      <th className="px-2 py-1.5 text-left font-medium">Status</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {d.records.map((r, i) => (
                      <tr key={i} className="border-t border-border-strong/60">
                        <td className="px-2 py-1.5 font-mono">{r.type}</td>
                        <td className="max-w-[160px] truncate px-2 py-1.5 font-mono" title={r.name}>{r.name}</td>
                        <td className="max-w-[220px] truncate px-2 py-1.5 font-mono" title={r.value}>{r.value}</td>
                        <td className="px-2 py-1.5 font-mono">{r.ttl}</td>
                        <td className="px-2 py-1.5">
                          {r.status === "verified"
                            ? <Badge variant="success">OK</Badge>
                            : <Badge variant="outline">{r.status || "pendente"}</Badge>}
                        </td>
                        <td className="px-2 py-1.5">
                          <Button type="button" variant="ghost" size="icon" onClick={() => copiar(r.value)} title="Copiar valor">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        <form onSubmit={criar} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="dominio-novo">Domínio</Label>
            <Input id="dominio-novo" value={novoDominio} onChange={(e) => setNovoDominio(e.target.value)} placeholder="seudominio.com" />
          </div>
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4" /> {creating ? "Registrando…" : "Adicionar domínio"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
