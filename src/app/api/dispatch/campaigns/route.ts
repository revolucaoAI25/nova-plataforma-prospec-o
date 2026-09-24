import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarCampanhas, criarCampanha, perfilComDisparoHabilitado, instanciaPertenceAoUsuario } from "@/lib/dispatch-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const campanhas = await listarCampanhas(supabase, user.id);
  return NextResponse.json({ campanhas });
}

const bodySchema = z.object({
  nome: z.string().min(1),
  instanceId: z.string().uuid(),
  tipoOrigem: z.enum(["busca_existente", "upload", "manual", "auto_trigger", "sheet_watch"]),
  origemSearchId: z.string().uuid().optional(),
  filtroNicho: z.string().optional(),
  filtroSubnicho: z.string().optional(),
  filtroUf: z.string().optional(),
  intervaloMinSeg: z.number().int().min(5).default(30),
  intervaloMaxSeg: z.number().int().min(5).default(90),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await perfilComDisparoHabilitado(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Disparo não habilitado para sua conta." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  if (!(await instanciaPertenceAoUsuario(supabase, parsed.data.instanceId, profile))) {
    return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });
  }

  const id = await criarCampanha(supabase, user.id, parsed.data);
  if (!id) return NextResponse.json({ error: "Não foi possível criar a campanha." }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}
