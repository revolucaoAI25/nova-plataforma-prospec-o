import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { configPlataforma } from "@/lib/platform-settings";
import { tokenParaSeletor } from "@/lib/integrations/google-sheets";
import type { GoogleSheetsCreds } from "@/lib/database.types";

/**
 * Dados para abrir o seletor do Google (Picker) no navegador: o token de
 * acesso da própria pessoa (só o escopo drive.file), a chave de API e o
 * número do projeto (App ID). O arquivo escolhido fica liberado para a
 * plataforma ler e escrever.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", user.id).single();
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds | null)?.oauth;
  if (!creds) return NextResponse.json({ error: "Conecte a sua conta Google em Conexões." }, { status: 400 });

  const [apiKey, appId] = await Promise.all([
    configPlataforma("google_picker_api_key", process.env.GOOGLE_PICKER_API_KEY),
    configPlataforma("google_projeto_numero", process.env.GOOGLE_PROJETO_NUMERO),
  ]);
  if (!apiKey.trim() || !appId.trim()) {
    return NextResponse.json({ error: "O seletor de planilhas ainda não está disponível. Fale com o suporte." }, { status: 503 });
  }

  try {
    const accessToken = await tokenParaSeletor(creds);
    return NextResponse.json({ accessToken, apiKey: apiKey.trim(), appId: appId.trim() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
