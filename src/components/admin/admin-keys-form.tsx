"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Profile } from "@/lib/database.types";

export function AdminKeysForm({ userId, profile }: { userId: string; profile: Profile }) {
  const [cddKey, setCddKey] = useState(profile.cdd_api_key_admin || "");
  const [poolJson, setPoolJson] = useState(JSON.stringify(profile.maps_keys_pool ?? [], null, 2));
  const [apifyKey, setApifyKey] = useState(profile.apify_api_key_admin || "");
  const [apifyPoolJson, setApifyPoolJson] = useState(JSON.stringify(profile.apify_keys_pool ?? [], null, 2));
  const [contaTeste, setContaTeste] = useState(profile.conta_teste);
  const [testeExpiraEm, setTesteExpiraEm] = useState(profile.teste_expira_em ? profile.teste_expira_em.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function parsePool(json: string, label: string): unknown[] | null {
    try {
      const pool = JSON.parse(json);
      if (!Array.isArray(pool)) throw new Error();
      return pool;
    } catch {
      setFeedback({ ok: false, msg: `O pool de chaves ${label} precisa ser um JSON de lista válido.` });
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const mapsPool = parsePool(poolJson, "Maps");
    if (!mapsPool) return setSaving(false);
    const apifyPool = parsePool(apifyPoolJson, "Apify");
    if (!apifyPool) return setSaving(false);

    const resp = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cdd_api_key_admin: cddKey || null,
        maps_keys_pool: mapsPool,
        apify_api_key_admin: apifyKey || null,
        apify_keys_pool: apifyPool,
        conta_teste: contaTeste,
        teste_expira_em: contaTeste ? (testeExpiraEm || null) : null,
      }),
    });
    setFeedback(resp.ok ? { ok: true, msg: "Configurações salvas." } : { ok: false, msg: "Não foi possível salvar." });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta de teste</CardTitle>
          <CardDescription>Créditos pré-carregados e prazo de validade — bloqueia o acesso automaticamente ao expirar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
            É conta de teste
            <Switch checked={contaTeste} onCheckedChange={setContaTeste} />
          </label>
          {contaTeste && (
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="teste-expira-em">Expira em</Label>
              <Input id="teste-expira-em" type="date" value={testeExpiraEm} onChange={(e) => setTesteExpiraEm(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Casa dos Dados (CNPJ)</CardTitle>
          <CardDescription>Usada quando o usuário não tem uma chave própria configurada.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cdd-key">Chave administrada</Label>
            <Input id="cdd-key" type="password" value={cddKey} onChange={(e) => setCddKey(e.target.value)} placeholder="Deixe vazio para usar a chave padrão da plataforma" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pool de chaves Google Maps</CardTitle>
          <CardDescription>
            Rodízio automático mensal. Cada entrada: {"{"}&quot;key&quot;, &quot;limit&quot;, &quot;usage&quot;, &quot;month&quot;{"}"}.
            Deixe como <code>[]</code> para usar a chave padrão da plataforma (sem rodízio). Contas de teste usam o pool
            compartilhado da plataforma (Configurações não gerencia isso aqui).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={poolJson} onChange={(e) => setPoolJson(e.target.value)} rows={8} className="font-mono text-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apify (Instagram / fallback de Maps)</CardTitle>
          <CardDescription>Chave administrada e pool com rodízio, mesma lógica do Google Maps.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apify-key-admin">Chave administrada</Label>
            <Input id="apify-key-admin" type="password" value={apifyKey} onChange={(e) => setApifyKey(e.target.value)} placeholder="Deixe vazio para usar a chave padrão da plataforma" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apify-pool">Pool de chaves</Label>
            <Textarea id="apify-pool" value={apifyPoolJson} onChange={(e) => setApifyPoolJson(e.target.value)} rows={6} className="font-mono text-xs" />
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
