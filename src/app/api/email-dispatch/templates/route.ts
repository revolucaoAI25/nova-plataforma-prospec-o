import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarTemplatesEmail, criarTemplateEmail, perfilComEmailDisparoHabilitado } from "@/lib/email-dispatch-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const templates = await listarTemplatesEmail(supabase, user.id);
  return NextResponse.json({ templates });
}

const bodySchema = z.object({
  nome: z.string().min(1),
  assunto: z.string().min(1),
  corpo: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await perfilComEmailDisparoHabilitado(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Disparo por e-mail não habilitado para sua conta." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const id = await criarTemplateEmail(supabase, user.id, parsed.data);
  if (!id) return NextResponse.json({ error: "Não foi possível criar o template." }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}
