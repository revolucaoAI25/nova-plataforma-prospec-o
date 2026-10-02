"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/layout/logo";

/** Chega aqui pelo link do e-mail (sessão criada em /auth/confirmar). */
export default function NovaSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não são iguais.");
    setSalvando(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      setErro(
        /session|jwt|auth/i.test(error.message)
          ? "Este link expirou. Peça um novo link de recuperação."
          : "Não foi possível salvar a nova senha. Tente outra senha.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div className="bg-glow animate-pulse-glow h-[420px] w-[420px] -translate-y-1/3" aria-hidden="true" />
      <div className="relative">
        <Card className="w-full max-w-sm backdrop-blur-sm">
          <CardHeader className="items-center text-center">
            <Logo size="lg" className="mb-2" />
            <span className="eyebrow">Leadmatic · Revolução AI</span>
            <CardTitle className="text-2xl">Nova senha</CardTitle>
            <CardDescription>Escolha a senha que você vai usar para entrar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvar} className="flex flex-col gap-4">
              {erro && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {erro}{" "}
                    {erro.includes("expirou") && <Link href="/redefinir-senha" className="font-semibold underline">Pedir novo link</Link>}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senha">Nova senha</Label>
                <Input id="senha" type="password" autoComplete="new-password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmacao">Confirme a nova senha</Label>
                <Input id="confirmacao" type="password" autoComplete="new-password" required minLength={8} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
              </div>
              <Button type="submit" disabled={salvando} withArrow className="mt-2 w-full">
                {salvando ? "Salvando…" : "Salvar e entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
