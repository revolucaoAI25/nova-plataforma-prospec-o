import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listarPesquisas } from "@/lib/db";

/** Lista as pesquisas do usuário — usado pelo seletor de "Pesquisa do histórico" no construtor de fluxos. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const pesquisas = await listarPesquisas(supabase, 200);
  return NextResponse.json({ pesquisas });
}
