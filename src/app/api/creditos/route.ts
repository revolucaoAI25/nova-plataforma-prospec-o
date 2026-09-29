import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listarPacotesAtivos, listarComprasDoUsuario } from "@/lib/credit-purchases-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [pacotes, compras] = await Promise.all([
    listarPacotesAtivos(supabase),
    listarComprasDoUsuario(supabase, user.id),
  ]);

  return NextResponse.json({ pacotes, compras });
}
