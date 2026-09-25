import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterTemplateEmail, atualizarTemplateEmail, deletarTemplateEmail } from "@/lib/email-dispatch-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const template = await obterTemplateEmail(supabase, id);
  if (!template) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
  return NextResponse.json({ template });
}

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  assunto: z.string().min(1).optional(),
  corpo: z.string().min(1).optional(),
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

  const ok = await atualizarTemplateEmail(supabase, id, parsed.data);
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar o template." }, { status: 500 });
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

  const ok = await deletarTemplateEmail(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover o template." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
