import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tabelaEnriquecimento } from "@/lib/export";
import { enviarTabelaParaSheets } from "@/lib/export-sheets-rota";
import type { EnrichmentLeadRow } from "@/lib/database.types";

/** Envia o resultado do enriquecimento por IA para uma planilha do Google Sheets conectada. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // RLS: execução de outra conta não aparece.
  const { data: run } = await supabase.from("enrichment_runs").select("id").eq("id", id).maybeSingle();
  if (!run) return NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });
  const { data: leads } = await supabase.from("enrichment_leads").select("*").eq("run_id", id).order("created_at", { ascending: true });
  return enviarTabelaParaSheets(request, supabase, user.id, tabelaEnriquecimento((leads as EnrichmentLeadRow[]) ?? []));
}
