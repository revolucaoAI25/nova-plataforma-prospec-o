import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buscarLeadsDaPesquisa } from "@/lib/db";
import { exportar } from "@/lib/integrations/google-sheets";
import type { GoogleSheetsCreds } from "@/lib/database.types";

const bodySchema = z.object({
  sheetId: z.string(),
  aba: z.string(),
  modo: z.enum(["substituir", "acrescentar"]).default("substituir"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const { searchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", user.id).single();
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds)?.oauth;
  if (!creds) return NextResponse.json({ error: "Google Sheets não conectado." }, { status: 400 });

  const leads = await buscarLeadsDaPesquisa(supabase, searchId);
  if (!leads.length) return NextResponse.json({ error: "Pesquisa sem leads para exportar." }, { status: 400 });

  const resultado = await exportar(leads, creds, parsed.data.sheetId, parsed.data.aba, parsed.data.modo);
  if (!resultado.ok) return NextResponse.json({ error: resultado.msg }, { status: 502 });
  return NextResponse.json({ ok: true, msg: resultado.msg });
}
