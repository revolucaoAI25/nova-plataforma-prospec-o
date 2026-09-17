"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldGroup, FieldRow } from "@/components/ui/field-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyPoolEditor } from "@/components/admin/key-pool-editor";
import type { ApiKeyPoolEntry, Profile } from "@/lib/database.types";

export function AdminKeysForm({ userId, profile }: { userId: string; profile: Profile }) {
  const [cddKey, setCddKey] = useState(profile.cdd_api_key_admin || "");
  const [mapsPool, setMapsPool] = useState<ApiKeyPoolEntry[]>(profile.maps_keys_pool ?? []);
  const [apifyKey, setApifyKey] = useState(profile.apify_api_key_admin || "");
  const [apifyPool, setApifyPool] = useState<ApiKeyPoolEntry[]>(profile.apify_keys_pool ?? []);
  const [contaTeste, setContaTeste] = useState(profile.conta_teste);
  const [testeExpiraEm, setTesteExpiraEm] = useState(profile.teste_expira_em ? profile.teste_expira_em.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const resp = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cdd_api_key_admin: cddKey || null,
        maps_keys_pool: mapsPool.filter((k) => k.key.trim()),
        apify_api_key_admin: apifyKey || null,
        apify_keys_pool: apifyPool.filter((k) => k.key.trim()),
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
          <FieldGroup>
            <FieldRow label="É conta de teste" control={<Switch checked={contaTeste} onCheckedChange={setContaTeste} />} />
          </FieldGroup>
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
            Rodízio automático mensal entre as chaves abaixo. Sem nenhuma chave, o usuário usa a chave padrão da
            plataforma. Contas de teste usam o pool compartilhado da plataforma — não é gerenciado aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeyPoolEditor value={mapsPool} onChange={setMapsPool} keyPlaceholder="AIza…" />
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
            <Label>Pool de chaves</Label>
            <KeyPoolEditor value={apifyPool} onChange={setApifyPool} keyPlaceholder="apify_api_…" />
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
