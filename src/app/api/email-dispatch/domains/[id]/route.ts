import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterDominioEmail, deletarDominioEmail, perfilComEmailDisparoHabilitado } from "@/lib/email-dispatch-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const domain = await obterDominioEmail(supabase, id);
  if (!domain) return NextResponse.json({ error: "Domínio não encontrado." }, { status: 404 });
  return NextResponse.json({ domain });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComEmailDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo por e-mail não habilitado para sua conta." }, { status: 403 });
  }

  const ok = await deletarDominioEmail(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover o domínio." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
