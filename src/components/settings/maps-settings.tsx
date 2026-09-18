"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldGroup, FieldRow } from "@/components/ui/field-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyPoolEditor } from "@/components/admin/key-pool-editor";
import type { ApiKeyPoolEntry, Profile } from "@/lib/database.types";

export function MapsSettings({ profile }: { profile: Profile }) {
  const [googleMapsKey, setGoogleMapsKey] = useState(profile.google_maps_api_key || "");
  const [pool, setPool] = useState<ApiKeyPoolEntry[]>(profile.maps_keys_pool ?? []);
  const [pausarAoEsgotar, setPausarAoEsgotar] = useState(profile.maps_pausar_ao_esgotar);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const contaTeste = profile.conta_teste;
  const gerenciadoPeloAdmin = !contaTeste && profile.maps_credits_enabled;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const resp = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_maps_api_key: googleMapsKey || null,
        maps_keys_pool: pool.filter((k) => k.key.trim()),
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
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> Google Maps</CardTitle>
          <CardDescription>
            {contaTeste
              ? "Contas de teste sempre usam a chave compartilhada da plataforma — não é possível configurar uma chave própria."
              : gerenciadoPeloAdmin
                ? "Sua conta usa a chave/pool administrado pela plataforma — não é necessário configurar nada aqui."
                : "Configure uma ou mais chaves da API do Google Maps. O sistema usa rodízio automático quando uma chave atinge o limite mensal."}
          </CardDescription>
        </CardHeader>
        {!contaTeste && !gerenciadoPeloAdmin && (
          <CardContent className="flex flex-col gap-4">
            <KeyPoolEditor value={pool} onChange={setPool} keyPlaceholder="AIza…" />
            <FieldGroup>
              <FieldRow
                label="Ao esgotar o limite das chaves: continuar buscando"
                description="Quando desligado, a busca pausa ao esgotar a cota em vez de continuar (o que pode gerar custo extra)."
                control={<Switch checked={!pausarAoEsgotar} onCheckedChange={(v) => setPausarAoEsgotar(!v)} />}
              />
            </FieldGroup>
            <details className="rounded-xl border border-dashed border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Ou use chave única (modo legado)</summary>
              <div className="mt-3 flex flex-col gap-1.5">
                <Label htmlFor="gmaps-key">Chave única</Label>
                <Input
                  id="gmaps-key"
                  type="password"
                  value={googleMapsKey}
                  onChange={(e) => setGoogleMapsKey(e.target.value)}
                  placeholder="AIza…"
                />
              </div>
            </details>
          </CardContent>
        )}
      </Card>

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "destructive"}>
          <AlertDescription>{feedback.msg}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={saving || contaTeste || gerenciadoPeloAdmin} className="self-start">
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
