import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterRunBigDataCorp, listarLeadsRunBigDataCorp } from "@/lib/bigdatacorp-enrichment-db";
import { tabelaSociosContato } from "@/lib/export";
import { enviarTabelaParaSheets } from "@/lib/export-sheets-rota";

/** Envia o resultado de "Sócios e Contato" para uma planilha do Google Sheets conectada. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const run = await obterRunBigDataCorp(supabase, id);
  if (!run) return NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });
  const tabela = tabelaSociosContato(await listarLeadsRunBigDataCorp(supabase, id));
  return enviarTabelaParaSheets(request, supabase, user.id, tabela);
}
