import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportarGenerico } from "@/lib/integrations/google-sheets";
import type { TabelaExport } from "@/lib/export";
import type { GoogleSheetsCreds } from "@/lib/database.types";

const bodySchema = z.object({
  sheetId: z.string().min(1),
  aba: z.string().min(1),
  modo: z.enum(["substituir", "acrescentar"]).default("acrescentar"),
});

/**
 * Corpo comum das rotas "exportar para o Google Sheets" dos
 * enriquecimentos: confere o pedido e a conexão do usuário com o Google e
 * grava a tabela na planilha escolhida.
 */
export async function enviarTabelaParaSheets(
  request: Request, supabase: SupabaseClient, userId: string, tabela: TabelaExport,
): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  if (!tabela.linhas.length) return NextResponse.json({ error: "Nada para exportar ainda." }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", userId).single();
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds | null)?.oauth;
  if (!creds) return NextResponse.json({ error: "Google Sheets não conectado." }, { status: 400 });

  const r = await exportarGenerico(tabela.linhas, tabela.colunas, creds, parsed.data.sheetId, parsed.data.aba, parsed.data.modo);
  if (!r.ok) return NextResponse.json({ error: r.msg }, { status: 502 });
  return NextResponse.json({ ok: true, msg: r.msg });
}
