import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { GoogleSheetsCreds } from "@/lib/database.types";

const bodySchema = z.object({
  planilhas: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      aba: z.string(),
      modo: z.enum(["substituir", "acrescentar"]),
      padrao: z.boolean().optional(),
    }),
  ),
  autoExport: z.boolean(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", user.id).single();
  const atual = (profile?.google_sheets_creds as GoogleSheetsCreds) || {};
  if (!atual.oauth) return NextResponse.json({ error: "Google Sheets não conectado." }, { status: 400 });

  const novo: GoogleSheetsCreds = { oauth: atual.oauth, planilhas: parsed.data.planilhas, auto_export: parsed.data.autoExport };
  const { error } = await supabase.from("profiles").update({ google_sheets_creds: novo }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
