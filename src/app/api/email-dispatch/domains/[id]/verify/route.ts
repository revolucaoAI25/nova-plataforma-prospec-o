import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarDominioEmail, perfilComEmailDisparoHabilitado } from "@/lib/email-dispatch-db";

export async function POST(
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

  const domain = await verificarDominioEmail(supabase, id);
  if (!domain) return NextResponse.json({ error: "Domínio não encontrado." }, { status: 404 });
  return NextResponse.json({ domain });
}
