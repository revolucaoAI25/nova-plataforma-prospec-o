import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { obterFunil, funilPertenceAoUsuario, listarColunas, listarCards, renomearFunil, excluirFunil } from "@/lib/funil-db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }

  const [funil, colunas, cards] = await Promise.all([
    obterFunil(supabase, id),
    listarColunas(supabase, id),
    listarCards(supabase, id),
  ]);
  return NextResponse.json({ funil, colunas, cards });
}

const patchSchema = z.object({ nome: z.string().min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const ok = await renomearFunil(supabase, id, parsed.data.nome);
  if (!ok) return NextResponse.json({ error: "Não foi possível renomear o funil." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }

  const ok = await excluirFunil(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível excluir o funil." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
