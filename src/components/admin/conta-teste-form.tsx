"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldGroup, FieldRow } from "@/components/ui/field-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Profile } from "@/lib/database.types";

export function ContaTesteForm({ userId, profile, creditosTeste }: { userId: string; profile: Profile; creditosTeste: number }) {
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
      body: JSON.stringify({ conta_teste: contaTeste, teste_expira_em: contaTeste ? (testeExpiraEm || null) : null }),
    });
    setFeedback(resp.ok ? { ok: true, msg: "Configurações salvas." } : { ok: false, msg: "Não foi possível salvar." });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" /> Conta de teste</CardTitle>
          <CardDescription>
            Ao ativar, a conta recebe {creditosTeste.toLocaleString("pt-BR")} créditos (quantidade global, em Chaves da plataforma) e acesso
            a toda a plataforma — exceto disparo por LinkedIn e canal oficial de WhatsApp. Não pode comprar créditos nem assinar planos.
            O acesso é bloqueado automaticamente ao expirar.
          </CardDescription>
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
