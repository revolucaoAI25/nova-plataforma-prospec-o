import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterConta, atualizarConta, deletarConta, perfilComLinkedinDisparoHabilitado } from "@/lib/linkedin-dispatch-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const conta = await obterConta(supabase, id);
  if (!conta) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  return NextResponse.json({ conta });
}

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  limiteDiarioConvites: z.number().int().min(1).optional(),
  limiteDiarioMensagens: z.number().int().min(1).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComLinkedinDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo por LinkedIn não habilitado para sua conta." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) campos.nome = parsed.data.nome;
  if (parsed.data.limiteDiarioConvites !== undefined) campos.limite_diario_convites = parsed.data.limiteDiarioConvites;
  if (parsed.data.limiteDiarioMensagens !== undefined) campos.limite_diario_mensagens = parsed.data.limiteDiarioMensagens;

  const ok = await atualizarConta(supabase, id, campos);
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar a conta." }, { status: 500 });
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

  const ok = await deletarConta(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover a conta." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
