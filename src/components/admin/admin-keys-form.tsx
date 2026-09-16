"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Profile } from "@/lib/database.types";

export function AdminKeysForm({ userId, profile }: { userId: string; profile: Profile }) {
  const [cddKey, setCddKey] = useState(profile.cdd_api_key_admin || "");
  const [poolJson, setPoolJson] = useState(JSON.stringify(profile.maps_keys_pool ?? [], null, 2));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    let pool;
    try {
      pool = JSON.parse(poolJson);
      if (!Array.isArray(pool)) throw new Error();
    } catch {
      setFeedback({ ok: false, msg: "O pool de chaves Maps precisa ser um JSON de lista válido." });
      setSaving(false);
      return;
    }

    const resp = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cdd_api_key_admin: cddKey || null, maps_keys_pool: pool }),
    });
    setFeedback(resp.ok ? { ok: true, msg: "Chaves salvas." } : { ok: false, msg: "Não foi possível salvar." });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
            Deixe como <code>[]</code> para usar a chave padrão da plataforma (sem rodízio).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={poolJson} onChange={(e) => setPoolJson(e.target.value)} rows={10} className="font-mono text-xs" />
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
