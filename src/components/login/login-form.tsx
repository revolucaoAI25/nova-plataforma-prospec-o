"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/layout/logo";
import { caminhoInterno } from "@/lib/caminho-interno";
import { formatarData } from "@/lib/datas";
import { linkWhatsApp } from "@/components/lp/dados";

const MSG_PERFIL_AUSENTE = "Não encontramos os dados da sua conta. Fale com o suporte para regularizar o acesso.";

/** O e-mail fica lembrado neste navegador para a próxima entrada (só o e-mail, nunca a senha). */
const CHAVE_EMAIL = "lm_login_email";

function emailLembrado(): string {
  try {
    return localStorage.getItem(CHAVE_EMAIL) ?? "";
  } catch {
    return "";
  }
}

function salvarEmailLembrado(email: string | null) {
  try {
    if (email) localStorage.setItem(CHAVE_EMAIL, email);
    else localStorage.removeItem(CHAVE_EMAIL);
  } catch {
    // navegador sem armazenamento: só não lembra
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [voltando, setVoltando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("expirado")
      ? "Sua sessão expirou porque o prazo da conta de teste terminou."
      : searchParams.get("perfil_ausente")
        ? MSG_PERFIL_AUSENTE
        : null,
  );

  // Quem já entrou neste navegador encontra o e-mail preenchido e vai direto para a senha.
  useEffect(() => {
    const salvo = emailLembrado();
    if (!salvo) return;
    const id = requestAnimationFrame(() => {
      setEmail(salvo);
      setVoltando(true);
      document.getElementById("password")?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : /rate|limit|too many/i.test(error.message)
            ? "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente."
            : /not confirmed/i.test(error.message)
              ? "Confirme o seu e-mail pelo link que enviamos antes de entrar."
              : "Não foi possível entrar agora. Tente novamente em instantes.",
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
      setError(MSG_PERFIL_AUSENTE);
      setLoading(false);
      return;
    }
    if (profile.conta_teste && profile.teste_expira_em && new Date(profile.teste_expira_em) <= new Date()) {
      await supabase.auth.signOut();
      const dataExp = formatarData(profile.teste_expira_em);
      setError(`Sua conta de teste expirou em ${dataExp}. Fale com o administrador para renovar.`);
      setLoading(false);
      return;
    }

    salvarEmailLembrado(lembrar ? email.trim() : null);
    router.replace(caminhoInterno(searchParams.get("next")));
    router.refresh();
  }

  function verCapsLock(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <Logo size="lg" />
        <div className="leading-tight">
          <p className="font-lp-display text-lg font-bold tracking-tight text-foreground">Leadmatic</p>
          <p className="text-xs text-muted-foreground">por Revolução AI</p>
        </div>
      </div>

      <h1 className="font-lp-display text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-[34px]">
        {voltando ? "Bom te ver de novo" : "Entrar na sua conta"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {voltando ? "Digite a sua senha para continuar de onde parou." : "Use o e-mail e a senha que você cadastrou no Leadmatic."}
      </p>
      {voltando && (
        <button
          type="button"
          onClick={() => {
            salvarEmailLembrado(null);
            setEmail("");
            setVoltando(false);
            document.getElementById("email")?.focus();
          }}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          Não é você? Entrar com outro e-mail
        </button>
      )}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5 [@media(max-height:760px)]:mt-6 [@media(max-height:760px)]:gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@empresa.com.br"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10 text-[15px]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Senha</Label>
            <Link href="/redefinir-senha" className="text-xs font-medium text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" aria-hidden="true" />
            <Input
              id="password"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={verCapsLock}
              onKeyDown={verCapsLock}
              className="h-12 pl-10 pr-12 text-[15px]"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? "Esconder a senha" : "Mostrar a senha"}
              aria-pressed={mostrarSenha}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {capsLock && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">A tecla Caps Lock está ativada.</p>}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
          <Checkbox checked={lembrar} onCheckedChange={(v) => setLembrar(v === true)} />
          Lembrar meu e-mail neste computador
        </label>

        <Button type="submit" disabled={loading} className="h-12 w-full text-[15px]">
          {loading ? "Entrando…" : "Entrar na plataforma"} {!loading && <ArrowRight />}
        </Button>
      </form>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4 [@media(max-height:760px)]:mt-6">
        <p className="text-sm font-semibold text-foreground">Ainda não é cliente?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Conheça a plataforma por 7 dias, sem cartão.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/teste-gratis">Testar grátis</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/conheca#planos" prefetch={false}>Ver planos</Link>
          </Button>
        </div>
      </div>

      <a
        href={linkWhatsApp("Olá! Preciso de ajuda para entrar na minha conta do Leadmatic.")}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageCircle className="h-4 w-4" /> Não consegue entrar? Fale com o suporte
      </a>
    </div>
  );
}
