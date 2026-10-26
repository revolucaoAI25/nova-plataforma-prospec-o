import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarInstancias, criarInstancia, perfilComDisparoHabilitado } from "@/lib/dispatch-db";
import { criarInstancia as evolutionCriarInstancia, evolutionConfigurado } from "@/lib/integrations/evolution-api";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo não habilitado para sua conta." }, { status: 403 });
  }

  const instancias = await listarInstancias(supabase, user.id);
  return NextResponse.json({ instancias });
}

const bodySchema = z.object({ nome: z.string().trim().max(60).optional(), limiteDiarioEnvios: z.number().int().min(1).optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo não habilitado para sua conta." }, { status: 403 });
  }
  if (!(await evolutionConfigurado())) {
    return NextResponse.json({ error: "A conexão pelo QR Code está indisponível no momento. Fale com o suporte." }, { status: 501 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira o nome e o limite diário." }, { status: 400 });

  const evolutionInstanceName = `${user.id.slice(0, 8)}_${Date.now()}`;
  try {
    await evolutionCriarInstancia(evolutionInstanceName);
  } catch (e) {
    console.error("[dispatch/instances] falha ao criar na Evolution", (e as Error).message);
    return NextResponse.json({ error: "O serviço de WhatsApp não respondeu. Tente de novo em instantes." }, { status: 502 });
  }

  // Sem nome: "WhatsApp 1", "WhatsApp 2"…
  const nome = parsed.data.nome || `WhatsApp ${(await listarInstancias(supabase, user.id)).filter((i) => i.canal === "evolution").length + 1}`;
  const id = await criarInstancia(supabase, user.id, nome, evolutionInstanceName, parsed.data.limiteDiarioEnvios ?? null);
  if (!id) return NextResponse.json({ error: "Erro ao salvar a instância." }, { status: 500 });

  return NextResponse.json({ id }, { status: 201 });
}
