import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterSender, atualizarSender, deletarSender, perfilComEmailDisparoHabilitado } from "@/lib/email-dispatch-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const sender = await obterSender(supabase, id);
  if (!sender) return NextResponse.json({ error: "Remetente não encontrado." }, { status: 404 });
  return NextResponse.json({ sender });
}

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  fromName: z.string().min(1).optional(),
  fromEmail: z.string().email().optional(),
  replyTo: z.string().email().nullable().optional(),
  ativo: z.boolean().optional(),
  limiteDiarioEnvios: z.number().int().min(1).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComEmailDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo por e-mail não habilitado para sua conta." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) campos.nome = parsed.data.nome;
  if (parsed.data.fromName !== undefined) campos.from_name = parsed.data.fromName;
  if (parsed.data.fromEmail !== undefined) campos.from_email = parsed.data.fromEmail;
  if (parsed.data.replyTo !== undefined) campos.reply_to = parsed.data.replyTo;
  if (parsed.data.ativo !== undefined) campos.ativo = parsed.data.ativo;
  if (parsed.data.limiteDiarioEnvios !== undefined) campos.limite_diario_envios = parsed.data.limiteDiarioEnvios;

  const ok = await atualizarSender(supabase, id, campos);
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar o remetente." }, { status: 500 });
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

  const ok = await deletarSender(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover o remetente." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
