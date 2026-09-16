import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarTemplatesDb, criarTemplateDb } from "@/lib/dispatch-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const templates = await listarTemplatesDb(supabase, user.id);
  return NextResponse.json({ templates });
}

const bodySchema = z.object({
  instanceId: z.string().uuid(),
  nome: z.string().min(1),
  categoria: z.string().min(1),
  corpo: z.string().min(1),
  nomeMeta: z.string().optional(),
  idioma: z.string().default("pt_BR"),
  cabecalho: z.string().optional(),
  rodape: z.string().optional(),
  variaveis: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const id = await criarTemplateDb(supabase, user.id, parsed.data);
  if (!id) return NextResponse.json({ error: "Não foi possível criar o template." }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}
