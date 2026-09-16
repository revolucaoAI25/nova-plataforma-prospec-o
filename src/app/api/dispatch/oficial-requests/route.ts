import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarSolicitacaoOficial, listarSolicitacoesOficial } from "@/lib/dispatch-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // RLS já restringe a linhas do próprio usuário (ou todas, se for admin).
  const todas = await listarSolicitacoesOficial(supabase);
  const minhas = todas.filter((r) => r.user_id === user.id);
  return NextResponse.json({ solicitacoes: minhas });
}

const bodySchema = z.object({ nomeDesejado: z.string().optional(), telefoneContato: z.string().optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const id = await criarSolicitacaoOficial(supabase, user.id, parsed.data.nomeDesejado, parsed.data.telefoneContato);
  if (!id) return NextResponse.json({ error: "Não foi possível registrar a solicitação." }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}
