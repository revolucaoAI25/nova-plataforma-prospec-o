import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarPlanilha, extrairSheetId, listarAbas, listarPlanilhas, MSG_SEM_ACESSO_PLANILHA, tokenComAcessoAmplo } from "@/lib/integrations/google-sheets";
import type { GoogleSheetsCreds } from "@/lib/database.types";

async function credsDoUsuario() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", user.id).single();
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds | null)?.oauth;
  if (!creds) return { erro: NextResponse.json({ error: "Google Sheets não conectado." }, { status: 400 }) };
  return { creds };
}

/** Sem `sheetId`: planilhas que a plataforma enxerga. Com `sheetId`: as abas (ou `semAcesso` se a planilha não foi liberada no seletor). */
export async function GET(request: Request) {
  const { creds, erro } = await credsDoUsuario();
  if (erro) return erro;

  const bruto = new URL(request.url).searchParams.get("sheetId");
  const sheetId = bruto ? (extrairSheetId(bruto) ?? bruto) : null;
  try {
    if (sheetId) {
      const abas = await listarAbas(creds, sheetId);
      return NextResponse.json({ abas });
    }
    const planilhas = await listarPlanilhas(creds);
    return NextResponse.json({ planilhas, acessoAmplo: tokenComAcessoAmplo(creds) });
  } catch (e) {
    const semAcesso = (e as Error).message === MSG_SEM_ACESSO_PLANILHA;
    return NextResponse.json({ error: (e as Error).message, semAcesso }, { status: semAcesso ? 403 : 502 });
  }
}

/** "Criar planilha nova": cria no Drive da pessoa, já liberada para a plataforma. */
export async function POST(request: Request) {
  const { creds, erro } = await credsDoUsuario();
  if (erro) return erro;
  const parsed = z.object({ titulo: z.string().trim().min(1).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dê um nome para a planilha." }, { status: 400 });
  try {
    return NextResponse.json(await criarPlanilha(creds, parsed.data.titulo), { status: 201 });
  } catch (e) {
    console.error("[google-sheets] criar planilha", (e as Error).message);
    return NextResponse.json({ error: "Não foi possível criar a planilha. Confira a conexão com o Google em Conexões." }, { status: 502 });
  }
}
