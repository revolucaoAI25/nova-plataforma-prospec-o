import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterCampanha, atualizarCampanha, deletarCampanha, listarEtapas, statsCampanha } from "@/lib/dispatch-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const campanha = await obterCampanha(supabase, id);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  const [etapas, stats] = await Promise.all([listarEtapas(supabase, id), statsCampanha(supabase, id)]);
  return NextResponse.json({ campanha, etapas, stats });
}

const patchSchema = z.object({
  status: z.enum(["rascunho", "ativa", "pausada", "concluida"]).optional(),
  nome: z.string().min(1).optional(),
  intervaloMinSeg: z.number().int().min(5).optional(),
  intervaloMaxSeg: z.number().int().min(5).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.status) campos.status = parsed.data.status;
  if (parsed.data.nome) campos.nome = parsed.data.nome;
  if (parsed.data.intervaloMinSeg) campos.intervalo_min_seg = parsed.data.intervaloMinSeg;
  if (parsed.data.intervaloMaxSeg) campos.intervalo_max_seg = parsed.data.intervaloMaxSeg;

  const ok = await atualizarCampanha(supabase, id, campos);
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar a campanha." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const ok = await deletarCampanha(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover a campanha." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
