"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { OficialConnectionRequestRow } from "@/lib/database.types";

function ProvisionForm({ solicitacao, onDone }: { solicitacao: OficialConnectionRequestRow; onDone: () => void }) {
  const [nome, setNome] = useState(solicitacao.nome_desejado || "");
  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [numeroConectado, setNumeroConectado] = useState(solicitacao.telefone_contato || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function provisionar() {
    if (!nome || !token || !phoneNumberId) {
      setError("Preencha nome, token e phone number ID.");
      return;
    }
    setSaving(true);
    setError(null);
    const resp = await fetch("/api/admin/dispatch/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: solicitacao.user_id, nome, token, phoneNumberId, wabaId, numeroConectado,
        solicitacaoId: solicitacao.id,
      }),
    });
    setSaving(false);
    if (!resp.ok) {
      const data = await resp.json();
      setError(data.error || "Não foi possível provisionar.");
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Nome da instância</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Número conectado</Label>
          <Input value={numeroConectado} onChange={(e) => setNumeroConectado(e.target.value)} className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Token (DatafyAPI)</Label>
          <Input value={token} onChange={(e) => setToken(e.target.value)} className="h-8" type="password" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Phone Number ID</Label>
          <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">WABA ID</Label>
          <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} className="h-8" />
        </div>
      </div>
      <Button size="sm" onClick={provisionar} disabled={saving} className="self-start">
        {saving ? "Provisionando…" : "Provisionar instância"}
      </Button>
    </div>
  );
}

export function AdminOficialRequests({ solicitacoesIniciais }: { solicitacoesIniciais: OficialConnectionRequestRow[] }) {
  const [solicitacoes, setSolicitacoes] = useState(solicitacoesIniciais);
  const [abertaPara, setAbertaPara] = useState<string | null>(null);

  function marcarConcluida(id: string) {
    setSolicitacoes((prev) => prev.map((s) => (s.id === id ? { ...s, status: "concluido" } : s)));
    setAbertaPara(null);
  }

  if (!solicitacoes.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {solicitacoes.map((s) => (
        <Card key={s.id}>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm font-medium">
              {s.nome_desejado || "Sem nome"} · {s.telefone_contato || "—"}
            </CardTitle>
            <Badge variant={s.status === "concluido" ? "success" : s.status === "em_andamento" ? "secondary" : "outline"}>
              {s.status}
            </Badge>
          </CardHeader>
          {s.status !== "concluido" && (
            <CardContent className="pt-0">
              {abertaPara === s.id ? (
                <ProvisionForm solicitacao={s} onDone={() => marcarConcluida(s.id)} />
              ) : (
                <Button size="sm" variant="outline" onClick={() => setAbertaPara(s.id)}>
                  Provisionar
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
