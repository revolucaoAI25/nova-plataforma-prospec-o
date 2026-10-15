import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { funilPertenceAoUsuario, colunaPertenceAoFunil, obterCard, moverCard, excluirCard, salvarAnotacoes } from "@/lib/funil-db";
import { historicoDoCard } from "@/lib/funil-historico";

const patchSchema = z.object({
  colunaId: z.string().uuid().optional(),
  ordem: z.number().int().min(0).default(0),
  anotacoes: z.string().max(5000).optional(),
}).refine((v) => v.colunaId !== undefined || v.anotacoes !== undefined, { message: "Nada para alterar." });

/** Detalhe do negócio: o card e o que já aconteceu com cada contato dele nas campanhas. */
export async function GET(
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

  const historico = await historicoDoCard(supabase, card.user_id, card.contatos ?? []);
  return NextResponse.json({ card, ...historico });
}

/**
 * Move o card (arraste no board ou "Mover para" no detalhe) — se a coluna
 * de destino tem um fluxo configurado, dispara pra esse lead. Também salva
 * as anotações do negócio.
 */
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

  if (parsed.data.anotacoes !== undefined) {
    if (!(await salvarAnotacoes(supabase, cardId, parsed.data.anotacoes))) {
      return NextResponse.json({ error: "Não foi possível salvar as anotações." }, { status: 500 });
    }
    if (!parsed.data.colunaId) return NextResponse.json({ ok: true });
  }

  if (!(await colunaPertenceAoFunil(supabase, parsed.data.colunaId!, id))) {
    return NextResponse.json({ error: "Coluna não encontrada." }, { status: 404 });
  }

  const resultado = await moverCard(supabase, cardId, parsed.data.colunaId!, parsed.data.ordem);
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
