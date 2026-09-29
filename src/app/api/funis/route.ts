import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarFunis, criarFunil } from "@/lib/funil-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const funis = await listarFunis(supabase, user.id);
  return NextResponse.json({ funis });
}

const bodySchema = z.object({ nome: z.string().min(1) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const id = await criarFunil(supabase, user.id, parsed.data.nome);
  if (!id) return NextResponse.json({ error: "Não foi possível criar o funil." }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}
