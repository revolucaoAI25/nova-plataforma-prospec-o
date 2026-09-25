import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarSenders, criarSender, perfilComEmailDisparoHabilitado } from "@/lib/email-dispatch-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComEmailDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo por e-mail não habilitado para sua conta." }, { status: 403 });
  }

  const senders = await listarSenders(supabase, user.id);
  return NextResponse.json({ senders });
}

const bodySchema = z.object({
  nome: z.string().min(1),
  fromName: z.string().min(1),
  fromEmail: z.string().email(),
  replyTo: z.string().email().optional(),
  limiteDiarioEnvios: z.number().int().min(1).optional(),
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

  const id = await criarSender(supabase, user.id, parsed.data);
  if (!id) return NextResponse.json({ error: "Erro ao salvar o remetente." }, { status: 500 });

  return NextResponse.json({ id }, { status: 201 });
}
