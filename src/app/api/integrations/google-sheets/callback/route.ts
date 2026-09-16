import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { trocarCodigo } from "@/lib/integrations/google-sheets";
import type { GoogleSheetsCreds } from "@/lib/database.types";

function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-sheets/callback`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gs_oauth_state")?.value;

  const settingsUrl = new URL("/configuracoes", process.env.NEXT_PUBLIC_APP_URL);

  if (!code || !state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("sheets", "erro");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const oauth = await trocarCodigo(redirectUri(), code);
    const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", user.id).single();
    const atual = (profile?.google_sheets_creds as GoogleSheetsCreds) || {};
    const novo: GoogleSheetsCreds = { oauth, planilhas: atual.planilhas || [], auto_export: atual.auto_export || false };
    await supabase.from("profiles").update({ google_sheets_creds: novo }).eq("id", user.id);
    settingsUrl.searchParams.set("sheets", "conectado");
  } catch {
    settingsUrl.searchParams.set("sheets", "erro");
  }

  const resp = NextResponse.redirect(settingsUrl);
  resp.cookies.delete("gs_oauth_state");
  return resp;
}
