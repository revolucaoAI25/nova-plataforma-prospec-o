import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarInstancias, criarInstancia } from "@/lib/dispatch-db";
import { criarInstancia as evolutionCriarInstancia, evolutionConfigurado } from "@/lib/integrations/evolution-api";

async function requireDisparo(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const profile = await getProfile(supabase, userId);
  if (!profile) return null;
  if (!profile.disparo_habilitado && profile.role !== "admin") return null;
  return profile;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await requireDisparo(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo não habilitado para sua conta." }, { status: 403 });
  }

  const instancias = await listarInstancias(supabase, user.id);
  return NextResponse.json({ instancias });
}

const bodySchema = z.object({ nome: z.string().min(1) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await requireDisparo(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo não habilitado para sua conta." }, { status: 403 });
  }
  if (!evolutionConfigurado()) {
    return NextResponse.json({ error: "Evolution API não configurada nesta plataforma." }, { status: 501 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome para a instância." }, { status: 400 });

  const evolutionInstanceName = `${user.id.slice(0, 8)}_${Date.now()}`;
  try {
    await evolutionCriarInstancia(evolutionInstanceName);
  } catch (e) {
    return NextResponse.json({ error: `Erro ao criar instância na Evolution API: ${(e as Error).message}` }, { status: 502 });
  }

  const id = await criarInstancia(supabase, user.id, parsed.data.nome, evolutionInstanceName);
  if (!id) return NextResponse.json({ error: "Erro ao salvar a instância." }, { status: 500 });

  return NextResponse.json({ id }, { status: 201 });
}
