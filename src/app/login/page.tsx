"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("expirado")
      ? "Sua sessão expirou porque o prazo da conta de teste terminou."
      : searchParams.get("perfil_ausente")
        ? "Sua conta não tem um perfil configurado ainda. Veja em Table Editor → profiles no Supabase se existe uma linha com o mesmo id do seu usuário em Authentication → Users — se não existir, crie uma manualmente (ou peça pro administrador)."
        : null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message,
      );
      setLoading(false);
      return;
    }

    // Perfil ausente (linha em `profiles` não existe pra este usuário) ou
    // conta de teste expirada: nunca deixa a sessão de pé nesses casos —
    // mesma checagem repetida a cada navegação em (app)/layout.tsx, mas
    // resolvida aqui já dá feedback imediato em vez de um round-trip extra.
    const { data: profile } = await supabase
      .from("profiles")
      .select("conta_teste, teste_expira_em")
      .eq("id", signInData.user.id)
      .single();
    if (!profile) {
      await supabase.auth.signOut();
      setError(
        "Sua conta não tem um perfil configurado ainda. Veja em Table Editor → profiles no Supabase se existe uma linha com o mesmo id do seu usuário em Authentication → Users — se não existir, crie uma manualmente (ou peça pro administrador).",
      );
      setLoading(false);
      return;
    }
    if (profile.conta_teste && profile.teste_expira_em && new Date(profile.teste_expira_em) <= new Date()) {
      await supabase.auth.signOut();
      const dataExp = new Date(profile.teste_expira_em).toLocaleDateString("pt-BR");
      setError(`Sua conta de teste expirou em ${dataExp}. Fale com o administrador para renovar.`);
      setLoading(false);
      return;
    }

    const next = searchParams.get("next") || "/";
    router.replace(next);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-[0_0_0_1px_rgba(0,200,83,0.4),0_8px_24px_-8px_rgba(0,200,83,0.6)]">
          R
        </div>
        <span className="eyebrow">Revolução AI</span>
        <CardTitle className="text-2xl">Entrar</CardTitle>
        <CardDescription>Acesse sua conta de prospecção ativa.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} withArrow className="mt-2 w-full">
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div
        className="bg-glow animate-pulse-glow h-[420px] w-[420px] -translate-y-1/3"
        aria-hidden="true"
      />
      <div className="relative">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
