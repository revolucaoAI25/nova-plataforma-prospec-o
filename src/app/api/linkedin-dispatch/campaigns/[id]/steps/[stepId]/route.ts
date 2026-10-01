import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deletarEtapaLinkedin, atualizarEtapaLinkedin } from "@/lib/linkedin-dispatch-db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { stepId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const ok = await deletarEtapaLinkedin(supabase, stepId);
  // A etapa fica presa ao histórico de quem já recebeu (log e posição na
  // cadência): o banco recusa apagar. Editar o texto continua possível.
  if (!ok) return NextResponse.json({ error: "Essa etapa já foi enviada pra alguns leads e fica no histórico. Edite o texto em vez de remover, ou crie outra campanha." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

const patchSchema = z.object({
  atrasoHoras: z.number().min(0).max(24 * 60).optional(),
  nota: z.string().max(300).nullable().optional(),
  corpo: z.string().max(8000).nullable().optional(),
  notaB: z.string().max(300).nullable().optional(),
  corpoB: z.string().max(8000).nullable().optional(),
});

/** Edita a etapa — texto, atraso e a variante B do teste A/B (RLS garante que a etapa é de campanha do usuário). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { stepId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const ok = await atualizarEtapaLinkedin(supabase, stepId, parsed.data);
  if (!ok) return NextResponse.json({ error: "Não foi possível salvar a etapa." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
