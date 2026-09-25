import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarCampanhasEmail, criarCampanhaEmail, perfilComEmailDisparoHabilitado, senderPertenceAoUsuario } from "@/lib/email-dispatch-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const campanhas = await listarCampanhasEmail(supabase, user.id);
  return NextResponse.json({ campanhas });
}

const bodySchema = z.object({
  nome: z.string().min(1),
  senderId: z.string().uuid(),
  tipoOrigem: z.enum(["busca_existente", "upload", "manual", "auto_trigger", "sheet_watch"]),
  origemSearchId: z.string().uuid().optional(),
  filtroNicho: z.string().optional(),
  filtroSubnicho: z.string().optional(),
  filtroUf: z.string().optional(),
  intervaloMinSeg: z.number().int().min(1).default(5),
  intervaloMaxSeg: z.number().int().min(1).default(15),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await perfilComEmailDisparoHabilitado(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Disparo por e-mail não habilitado para sua conta." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  if (!(await senderPertenceAoUsuario(supabase, parsed.data.senderId, profile))) {
    return NextResponse.json({ error: "Remetente não encontrado." }, { status: 404 });
  }

  const id = await criarCampanhaEmail(supabase, user.id, parsed.data);
  if (!id) return NextResponse.json({ error: "Não foi possível criar a campanha." }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}
