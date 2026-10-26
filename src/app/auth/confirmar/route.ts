import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { caminhoInterno } from "@/lib/caminho-interno";

const TIPOS: EmailOtpType[] = ["recovery", "email", "signup", "invite", "magiclink", "email_change"];

/**
 * Volta dos links enviados por e-mail (recuperação de senha): cria a sessão
 * e segue para `next` (só caminhos internos). Aceita os dois formatos:
 * - token_hash + type: o link do nosso e-mail (/api/senha/esqueci); abre em
 *   qualquer aparelho;
 * - code: o link padrão do Supabase, que só funciona no mesmo navegador que
 *   pediu (precisa estar em Authentication → URL Configuration → Redirect URLs).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const destino = caminhoInterno(url.searchParams.get("next"));

  const supabase = await createClient();
  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  } else if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }
  return NextResponse.redirect(new URL("/redefinir-senha?link_invalido=1", url.origin));
}
