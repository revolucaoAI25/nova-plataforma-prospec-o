import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { funilPertenceAoUsuario, criarColuna } from "@/lib/funil-db";

const bodySchema = z.object({ nome: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const colunaId = await criarColuna(supabase, id, parsed.data.nome);
  if (!colunaId) return NextResponse.json({ error: "Não foi possível criar a coluna." }, { status: 500 });
  return NextResponse.json({ id: colunaId }, { status: 201 });
}
