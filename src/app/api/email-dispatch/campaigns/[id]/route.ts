import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ritmoPatchSchema, ritmoParaColunas } from "@/lib/ritmo";
import { obterCampanhaEmail, atualizarCampanhaEmail, deletarCampanhaEmail, listarEtapasEmail, statsCampanhaEmail } from "@/lib/email-dispatch-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const campanha = await obterCampanhaEmail(supabase, id);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  const [etapas, stats] = await Promise.all([listarEtapasEmail(supabase, id), statsCampanhaEmail(supabase, id)]);
  return NextResponse.json({ campanha, etapas, stats });
}

const patchSchema = z.object({
  status: z.enum(["rascunho", "ativa", "pausada", "concluida"]).optional(),
  nome: z.string().min(1).optional(),
  intervaloMinSeg: z.number().int().min(1).max(86_400).optional(),
  intervaloMaxSeg: z.number().int().min(1).max(86_400).optional(),
  ...ritmoPatchSchema,
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

  const { colunas, erro } = ritmoParaColunas(parsed.data);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });
  const campos: Record<string, unknown> = { ...colunas };
  if (parsed.data.status) campos.status = parsed.data.status;
  if (parsed.data.nome) campos.nome = parsed.data.nome;

  const ok = await atualizarCampanhaEmail(supabase, id, campos);
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

  const ok = await deletarCampanhaEmail(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover a campanha." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
