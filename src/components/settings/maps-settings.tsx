"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Profile } from "@/lib/database.types";

export function MapsSettings({ profile }: { profile: Profile }) {
  const [googleMapsKey, setGoogleMapsKey] = useState(profile.google_maps_api_key || "");
  const [pausarAoEsgotar, setPausarAoEsgotar] = useState(profile.maps_pausar_ao_esgotar);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const contaTeste = profile.conta_teste;
  const gerenciadoPeloAdmin = !contaTeste && !profile.google_maps_api_key && (profile.maps_keys_pool?.length ?? 0) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const resp = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_maps_api_key: googleMapsKey || null,
        maps_pausar_ao_esgotar: pausarAoEsgotar,
      }),
    });
    setFeedback(resp.ok ? { ok: true, msg: "Configurações salvas." } : { ok: false, msg: "Não foi possível salvar." });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Maps</CardTitle>
          <CardDescription>
            {contaTeste
              ? "Contas de teste sempre usam a chave compartilhada da plataforma — não é possível configurar uma chave própria."
              : gerenciadoPeloAdmin
                ? "Sua conta usa a chave/pool administrado pela plataforma — não é necessário configurar nada aqui."
                : "Configure sua própria chave da API do Google Maps (Places API legado)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gmaps-key">Chave da API</Label>
            <Input
              id="gmaps-key"
              type="password"
              value={googleMapsKey}
              onChange={(e) => setGoogleMapsKey(e.target.value)}
              placeholder="AIza…"
              disabled={gerenciadoPeloAdmin || contaTeste}
            />
          </div>
          <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
            <span>
              Ao esgotar o limite das chaves: continuar buscando
              <span className="block text-xs font-normal text-muted-foreground">
                Quando desligado, a busca pausa ao esgotar a cota em vez de continuar (o que pode gerar custo extra).
              </span>
            </span>
            <Switch checked={!pausarAoEsgotar} onCheckedChange={(v) => setPausarAoEsgotar(!v)} disabled={contaTeste} />
          </label>
        </CardContent>
      </Card>

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "destructive"}>
          <AlertDescription>{feedback.msg}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={saving || contaTeste} className="self-start">
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
