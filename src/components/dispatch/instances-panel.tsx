"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, QrCode, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WhatsappInstanceRow } from "@/lib/database.types";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "secondary" | "destructive" }> = {
  conectado: { label: "Conectado", variant: "success" },
  conectando: { label: "Conectando…", variant: "secondary" },
  desconectado: { label: "Desconectado", variant: "destructive" },
};

function InstanceQr({ instanceId, onConnected }: { instanceId: string; onConnected: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/dispatch/instances/${instanceId}/qrcode`)
      .then((r) => r.json())
      .then((d) => (d.qrcode ? setQr(d.qrcode) : setError("QR code indisponível — tente novamente em instantes.")))
      .catch(() => setError("Não foi possível carregar o QR code."));

    pollRef.current = setInterval(async () => {
      const resp = await fetch(`/api/dispatch/instances/${instanceId}/status`);
      const data = await resp.json();
      if (data.status === "conectado") {
        if (pollRef.current) clearInterval(pollRef.current);
        onConnected();
      }
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  if (!qr) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Gerando QR code…</div>;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR code do WhatsApp" className="h-48 w-48 rounded-md border border-border" />
      <p className="text-xs text-muted-foreground">Escaneie no WhatsApp → Aparelhos conectados.</p>
    </div>
  );
}

export function InstancesPanel({ instanciasIniciais }: { instanciasIniciais: WhatsappInstanceRow[] }) {
  const [instancias, setInstancias] = useState(instanciasIniciais);
  const [nome, setNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrAbertoPara, setQrAbertoPara] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setCreating(true);
    setError(null);
    const resp = await fetch("/api/dispatch/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    const data = await resp.json();
    setCreating(false);
    if (!resp.ok) {
      setError(data.error || "Não foi possível criar a instância.");
      return;
    }
    setNome("");
    const listResp = await fetch("/api/dispatch/instances");
    const listData = await listResp.json();
    setInstancias(listData.instancias || []);
    setQrAbertoPara(data.id);
  }

  async function remover(id: string) {
    if (!confirm("Remover esta instância?")) return;
    await fetch(`/api/dispatch/instances/${id}`, { method: "DELETE" });
    setInstancias((prev) => prev.filter((i) => i.id !== id));
  }

  function marcarConectado(id: string) {
    setInstancias((prev) => prev.map((i) => (i.id === id ? { ...i, status: "conectado" } : i)));
    setQrAbertoPara(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Instâncias WhatsApp</CardTitle>
        <CardDescription>Números conectados via Evolution API (não-oficial) ou canal oficial (provisionado pelo admin).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {instancias.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma instância conectada ainda.</p>}

        {instancias.map((inst) => (
          <div key={inst.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{inst.nome}</span>{" "}
                <Badge variant="outline" className="ml-1">{inst.canal === "oficial" ? "Oficial" : "Evolution"}</Badge>
                {inst.numero_conectado && <span className="ml-2 text-sm text-muted-foreground">{inst.numero_conectado}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_LABEL[inst.status]?.variant ?? "secondary"}>{STATUS_LABEL[inst.status]?.label ?? inst.status}</Badge>
                {inst.canal === "evolution" && inst.status !== "conectado" && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setQrAbertoPara(qrAbertoPara === inst.id ? null : inst.id)}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={() => remover(inst.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            {qrAbertoPara === inst.id && <InstanceQr instanceId={inst.id} onConnected={() => marcarConectado(inst.id)} />}
          </div>
        ))}

        <form onSubmit={criar} className="flex gap-2">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da instância (ex: WhatsApp Vendas)" />
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4" /> {creating ? "Criando…" : "Nova instância"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
