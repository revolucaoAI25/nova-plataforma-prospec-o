import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarDominiosEmail, criarDominioEmail, perfilComEmailDisparoHabilitado, DominioJaRegistradoError } from "@/lib/email-dispatch-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComEmailDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo por e-mail não habilitado para sua conta." }, { status: 403 });
  }

  const domains = await listarDominiosEmail(supabase, user.id);
  return NextResponse.json({ domains });
}

const bodySchema = z.object({
  dominio: z.string().min(3).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domínio inválido."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComEmailDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo por e-mail não habilitado para sua conta." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  try {
    const domain = await criarDominioEmail(supabase, user.id, parsed.data.dominio);
    if (!domain) return NextResponse.json({ error: "Erro ao registrar o domínio." }, { status: 500 });
    return NextResponse.json({ domain }, { status: 201 });
  } catch (e) {
    if (e instanceof DominioJaRegistradoError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: "Erro ao registrar o domínio." }, { status: 500 });
  }
}
