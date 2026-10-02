"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/layout/logo";

function PedirLink() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(
    searchParams.get("link_invalido") ? "Este link expirou ou já foi usado. Peça um novo abaixo." : null,
  );

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirmar?next=/redefinir-senha/nova`,
    });
    setEnviando(false);
    // Limite de envios do Supabase é o único erro que vale mostrar; para o
    // resto, a mesma resposta, sem revelar se o e-mail tem conta.
    if (error && /rate|limit|seconds/i.test(error.message)) {
      setErro("Muitos pedidos seguidos. Aguarde um minuto e tente novamente.");
      return;
    }
    setEnviado(true);
  }

  return (
    <Card className="w-full max-w-sm backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <Logo size="lg" className="mb-2" />
        <span className="eyebrow">Leadmatic · Revolução AI</span>
        <CardTitle className="text-2xl">Recuperar senha</CardTitle>
        <CardDescription>Enviamos um link para você criar uma nova senha.</CardDescription>
      </CardHeader>
      <CardContent>
        {enviado ? (
          <div className="flex flex-col gap-4">
            <Alert variant="success">
              <AlertDescription>
                Se houver uma conta com este e-mail, o link chega em alguns minutos. Confira também a caixa de spam.
              </AlertDescription>
            </Alert>
            <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">Voltar para o login</Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4">
            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail da conta</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={enviando} withArrow className="mt-2 w-full">
              {enviando ? "Enviando…" : "Enviar link"}
            </Button>
            <Link href="/login" className="text-center text-sm text-muted-foreground hover:text-foreground">Lembrei a senha</Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div className="bg-glow animate-pulse-glow h-[420px] w-[420px] -translate-y-1/3" aria-hidden="true" />
      <div className="relative">
        <Suspense>
          <PedirLink />
        </Suspense>
      </div>
    </div>
  );
}
