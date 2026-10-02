import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { caminhoInterno } from "@/lib/caminho-interno";

/**
 * Volta dos links enviados por e-mail pelo Supabase (recuperação de senha):
 * troca o código pela sessão e segue para `next` (só caminhos internos).
 * A URL desta rota precisa estar em Authentication → URL Configuration →
 * Redirect URLs no Supabase.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");
  const destino = caminhoInterno(url.searchParams.get("next"));

  if (codigo) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }
  return NextResponse.redirect(new URL("/redefinir-senha?link_invalido=1", url.origin));
}
