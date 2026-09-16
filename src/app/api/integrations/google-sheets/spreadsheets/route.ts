import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listarPlanilhas, listarAbas } from "@/lib/integrations/google-sheets";
import type { GoogleSheetsCreds } from "@/lib/database.types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", user.id).single();
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds)?.oauth;
  if (!creds) return NextResponse.json({ error: "Google Sheets não conectado." }, { status: 400 });

  const sheetId = new URL(request.url).searchParams.get("sheetId");
  try {
    if (sheetId) {
      const abas = await listarAbas(creds, sheetId);
      return NextResponse.json({ abas });
    }
    const planilhas = await listarPlanilhas(creds);
    return NextResponse.json({ planilhas });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
