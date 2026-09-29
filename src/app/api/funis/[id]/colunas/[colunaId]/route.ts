import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { funilPertenceAoUsuario, colunaPertenceAoFunil, atualizarColuna, excluirColuna } from "@/lib/funil-db";

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  ordem: z.number().int().min(0).optional(),
  cor: z.string().nullable().optional(),
  fluxoId: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; colunaId: string }> },
) {
  const { id, colunaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }
  if (!(await colunaPertenceAoFunil(supabase, colunaId, id))) {
    return NextResponse.json({ error: "Coluna não encontrada." }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  // fluxoId passa pela RLS do próprio `supabase` (RLS bound ao usuário) —
  // se não voltar nada, ou o fluxo não existe ou não é do usuário (IDOR).
  if (parsed.data.fluxoId) {
    const { data: flow } = await supabase.from("automation_flows").select("id").eq("id", parsed.data.fluxoId).maybeSingle();
    if (!flow) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
  }

  const campos: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) campos.nome = parsed.data.nome;
  if (parsed.data.ordem !== undefined) campos.ordem = parsed.data.ordem;
  if (parsed.data.cor !== undefined) campos.cor = parsed.data.cor;
  if (parsed.data.fluxoId !== undefined) campos.fluxo_id = parsed.data.fluxoId;

  const ok = await atualizarColuna(supabase, colunaId, campos);
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar a coluna." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; colunaId: string }> },
) {
  const { id, colunaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }
  if (!(await colunaPertenceAoFunil(supabase, colunaId, id))) {
    return NextResponse.json({ error: "Coluna não encontrada." }, { status: 404 });
  }

  const ok = await excluirColuna(supabase, colunaId);
  if (!ok) return NextResponse.json({ error: "Não foi possível excluir a coluna." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
