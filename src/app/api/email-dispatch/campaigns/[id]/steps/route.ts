import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarEtapasEmail, criarEtapaEmail } from "@/lib/email-dispatch-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const etapas = await listarEtapasEmail(supabase, id);
  return NextResponse.json({ etapas });
}

const bodySchema = z.object({
  ordem: z.number().int().min(1),
  atrasoHoras: z.number().min(0),
  assunto: z.string().min(1),
  corpo: z.string().min(1),
  templateId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const stepId = await criarEtapaEmail(supabase, id, parsed.data);
  if (!stepId) return NextResponse.json({ error: "Não foi possível criar a etapa." }, { status: 500 });
  return NextResponse.json({ id: stepId }, { status: 201 });
}
