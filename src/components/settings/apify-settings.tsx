"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Profile } from "@/lib/database.types";

export function ApifySettings({ profile }: { profile: Profile }) {
  const [apifyKey, setApifyKey] = useState(profile.apify_api_key || "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const gerenciadoPeloAdmin =
    !profile.apify_api_key && ((profile.apify_keys_pool?.length ?? 0) > 0 || Boolean(profile.apify_api_key_admin));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const resp = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apify_api_key: apifyKey || null }),
    });
    setFeedback(resp.ok ? { ok: true, msg: "Configurações salvas." } : { ok: false, msg: "Não foi possível salvar." });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apify</CardTitle>
          <CardDescription>
            {gerenciadoPeloAdmin
              ? "Sua conta usa a chave/pool Apify administrado pela plataforma — não é necessário configurar nada aqui."
              : "Configure sua própria chave da API do Apify (api.apify.com). Usada para a busca por Instagram (quando disponível pra sua conta) e como alternativa automática quando a cota do Google Maps esgotar — vale configurar mesmo sem acesso ao Instagram."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apify-key">Chave da API Apify</Label>
            <Input
              id="apify-key"
              type="password"
              value={apifyKey}
              onChange={(e) => setApifyKey(e.target.value)}
              placeholder="apify_api_…"
              disabled={gerenciadoPeloAdmin}
            />
          </div>
        </CardContent>
      </Card>

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "destructive"}>
          <AlertDescription>{feedback.msg}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={saving} className="self-start">
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
