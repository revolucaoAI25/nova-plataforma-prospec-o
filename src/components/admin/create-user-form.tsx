"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CreateUserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cddCredits, setCddCredits] = useState(0);
  const [contaTeste, setContaTeste] = useState(false);
  const [testeExpiraEm, setTesteExpiraEm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const resp = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, cddCredits, contaTeste, testeExpiraEm: testeExpiraEm || undefined }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      setError(data.error || "Não foi possível criar o usuário.");
      setLoading(false);
      return;
    }
    setEmail("");
    setPassword("");
    setCddCredits(0);
    setContaTeste(false);
    setTesteExpiraEm("");
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="self-start">
        <UserPlus className="h-4 w-4" /> Novo usuário
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Criar novo usuário</CardTitle>
        <CardDescription>Outros campos de crédito e permissões ficam editáveis na tabela abaixo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-email">E-mail</Label>
              <Input id="new-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-64" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">Senha inicial</Label>
              <Input id="new-password" type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-48" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-credits">Créditos CNPJ iniciais</Label>
              <Input id="new-credits" type="number" min={0} value={cddCredits} onChange={(e) => setCddCredits(Number(e.target.value))} className="w-36" />
            </div>
          </div>

          <label className="flex max-w-md items-center justify-between rounded-xl border border-border p-3 text-sm">
            <span>
              Conta de teste
              <span className="block text-xs font-normal text-muted-foreground">
                Créditos pré-carregados, prazo de validade, usa a chave Maps compartilhada da plataforma (nunca chave própria).
              </span>
            </span>
            <Switch checked={contaTeste} onCheckedChange={setContaTeste} />
          </label>

          {contaTeste && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="teste-expira">Expira em</Label>
              <Input id="teste-expira" type="date" value={testeExpiraEm} onChange={(e) => setTesteExpiraEm(e.target.value)} className="w-48" />
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>{loading ? "Criando…" : "Criar"}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
