import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarLeadsDaPesquisa } from "@/lib/db";

/** Leads de uma pesquisa do histórico — usado pelo botão "Puxar do histórico" dos enriquecimentos (via IA e por CNPJ), pra reaproveitar leads já extraídos sem copiar/colar. RLS em `leads` já restringe ao dono. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const leads = await buscarLeadsDaPesquisa(supabase, id);
  return NextResponse.json({ leads });
}
