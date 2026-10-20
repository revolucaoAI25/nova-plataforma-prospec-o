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

/** Planilhas configuradas (sem as credenciais), para a exportação manual. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", user.id).single();
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds) || {};
  return NextResponse.json({
    conectado: Boolean(creds.oauth),
    planilhas: creds.oauth ? (creds.planilhas ?? []) : [],
    autoExport: Boolean(creds.oauth && creds.auto_export),
  });
}

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

  // A mesma planilha pode aparecer mais de uma vez, uma por aba; a mesma
  // aba duas vezes não. Fica uma única principal (a primeira marcada).
  const vistas = new Set<string>();
  const planilhas = parsed.data.planilhas.filter((p) => {
    const chave = `${p.id}\u0000${p.aba}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
  const principal = Math.max(planilhas.findIndex((p) => p.padrao), 0);
  const novo: GoogleSheetsCreds = {
    oauth: atual.oauth,
    planilhas: planilhas.map((p, i) => ({ ...p, padrao: i === principal })),
    auto_export: parsed.data.autoExport,
  };
  const { error } = await supabase.from("profiles").update({ google_sheets_creds: novo }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
