"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Megaphone } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { DispatchCampaignRow, WhatsappInstanceRow } from "@/lib/database.types";

const STATUS_VARIANT: Record<string, "success" | "secondary" | "outline"> = {
  ativa: "success",
  rascunho: "outline",
  pausada: "secondary",
  concluida: "secondary",
};

export function CampaignsPanel({
  campanhasIniciais,
  instancias,
}: {
  campanhasIniciais: DispatchCampaignRow[];
  instancias: WhatsappInstanceRow[];
}) {
  const [campanhas, setCampanhas] = useState(campanhasIniciais);
  const [nome, setNome] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !instanceId) return;
    setCreating(true);
    setError(null);
    const resp = await fetch("/api/dispatch/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, instanceId, tipoOrigem: "manual" }),
    });
    const data = await resp.json();
    setCreating(false);
    if (!resp.ok) {
      setError(data.error || "Não foi possível criar a campanha.");
      return;
    }
    setNome("");
    const listResp = await fetch("/api/dispatch/campaigns");
    const listData = await listResp.json();
    setCampanhas(listData.campanhas || []);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-primary" /> Campanhas</CardTitle>
        <CardDescription>Cadência de mensagens, alvos e ritmo de envio por campanha.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {campanhas.length === 0 && <EmptyState icon={Megaphone} title="Nenhuma campanha criada ainda" className="py-8" />}

        <ul className="divide-y divide-border">
          {campanhas.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/disparo/campanhas/${c.id}`} className="font-medium hover:underline">{c.nome}</Link>
                <p className="text-xs text-muted-foreground">
                  {c.intervalo_min_seg}–{c.intervalo_max_seg}s entre envios
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/disparo/campanhas/${c.id}`}>
                    Gerenciar <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={criar} className="flex flex-wrap gap-2">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da campanha" className="flex-1 min-w-[180px]" />
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Instância" /></SelectTrigger>
            <SelectContent>
              {instancias.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={creating || !instanceId}>
            <Plus className="h-4 w-4" /> {creating ? "Criando…" : "Nova campanha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
