"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyPoolEditor } from "@/components/admin/key-pool-editor";
import type { ApiKeyPoolEntry, Profile } from "@/lib/database.types";

export function ApifySettings({ profile }: { profile: Profile }) {
  const [apifyKey, setApifyKey] = useState(profile.apify_api_key || "");
  const [pool, setPool] = useState<ApiKeyPoolEntry[]>(profile.apify_keys_pool ?? []);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const contaTeste = profile.conta_teste;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const resp = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apify_api_key: apifyKey || null,
        apify_keys_pool: pool.filter((k) => k.key.trim()),
      }),
    });
    setFeedback(resp.ok ? { ok: true, msg: "Configurações salvas." } : { ok: false, msg: "Não foi possível salvar." });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Apify</CardTitle>
          <CardDescription>
            {contaTeste
              ? "Contas de teste sempre usam a chave Apify compartilhada da plataforma — não é possível configurar uma chave própria."
              : "Usada como fallback automático na busca Google Maps (quando a cota é esgotada) e na busca Instagram. Configure uma ou mais chaves — o sistema usa rodízio automático quando uma chave atinge o limite mensal."}
          </CardDescription>
        </CardHeader>
        {!contaTeste && (
          <CardContent className="flex flex-col gap-4">
            <KeyPoolEditor value={pool} onChange={setPool} keyPlaceholder="apify_api_…" />
            <details className="rounded-xl border border-dashed border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Ou use chave única (modo legado)</summary>
              <div className="mt-3 flex flex-col gap-1.5">
                <Label htmlFor="apify-key">Chave única</Label>
                <Input
                  id="apify-key"
                  type="password"
                  value={apifyKey}
                  onChange={(e) => setApifyKey(e.target.value)}
                  placeholder="apify_api_…"
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

      <Button type="submit" disabled={saving || contaTeste} className="self-start">
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
