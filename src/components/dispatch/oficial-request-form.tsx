"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function OficialRequestForm() {
  const [nomeDesejado, setNomeDesejado] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    const resp = await fetch("/api/dispatch/oficial-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomeDesejado, telefoneContato }),
    });
    setLoading(false);
    setFeedback(
      resp.ok
        ? { ok: true, msg: "Solicitação registrada! O administrador vai entrar em contato para provisionar seu número." }
        : { ok: false, msg: "Não foi possível registrar a solicitação." },
    );
    if (resp.ok) {
      setNomeDesejado("");
      setTelefoneContato("");
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {feedback && (
            <Alert variant={feedback.ok ? "success" : "destructive"}>
              <AlertDescription>{feedback.msg}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome-desejado">Nome desejado para a instância</Label>
            <Input id="nome-desejado" value={nomeDesejado} onChange={(e) => setNomeDesejado(e.target.value)} placeholder="Ex: WhatsApp Comercial" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telefone-contato">Telefone que será conectado</Label>
            <Input id="telefone-contato" value={telefoneContato} onChange={(e) => setTelefoneContato(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? "Enviando…" : "Solicitar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
