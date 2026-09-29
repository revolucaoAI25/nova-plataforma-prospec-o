import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { funilPertenceAoUsuario, colunaPertenceAoFunil, obterCard, moverCard, excluirCard } from "@/lib/funil-db";

const patchSchema = z.object({
  colunaId: z.string().uuid(),
  ordem: z.number().int().min(0).default(0),
});

/** Move o card (arraste no board) — se a coluna de destino tem um fluxo configurado, dispara pra esse lead. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  const { id, cardId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }

  const card = await obterCard(supabase, cardId);
  if (!card || card.funil_id !== id) return NextResponse.json({ error: "Card não encontrado." }, { status: 404 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  if (!(await colunaPertenceAoFunil(supabase, parsed.data.colunaId, id))) {
    return NextResponse.json({ error: "Coluna não encontrada." }, { status: 404 });
  }

  const resultado = await moverCard(supabase, cardId, parsed.data.colunaId, parsed.data.ordem);
  if (!resultado.ok) return NextResponse.json({ error: "Não foi possível mover o card." }, { status: 500 });
  return NextResponse.json({ ok: true, fluxoDisparado: resultado.fluxoDisparado ?? null });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  const { id, cardId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }

  const card = await obterCard(supabase, cardId);
  if (!card || card.funil_id !== id) return NextResponse.json({ error: "Card não encontrado." }, { status: 404 });

  const ok = await excluirCard(supabase, cardId);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover o card." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
