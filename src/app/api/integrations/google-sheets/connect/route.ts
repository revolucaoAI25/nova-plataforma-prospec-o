import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { gerarUrlAuth, oauthDisponivel } from "@/lib/integrations/google-sheets";

function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-sheets/callback`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  if (!oauthDisponivel()) {
    const settingsUrl = new URL("/configuracoes", process.env.NEXT_PUBLIC_APP_URL);
    settingsUrl.searchParams.set("sheets", "nao_configurado");
    return NextResponse.redirect(settingsUrl);
  }

  const state = randomBytes(24).toString("hex");
  const url = gerarUrlAuth(redirectUri(), state);

  const resp = NextResponse.redirect(url);
  resp.cookies.set("gs_oauth_state", state, { httpOnly: true, secure: true, maxAge: 600, path: "/" });
  return resp;
}
