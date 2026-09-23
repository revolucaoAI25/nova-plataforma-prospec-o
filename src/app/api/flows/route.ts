import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validarFluxo, type FlowGrafoNode } from "@/lib/flow/node-types";
import type { Json } from "@/lib/database.types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase.from("automation_flows").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fluxos: data });
}

const nodeSchema = z.object({
  id: z.string().min(1),
  tipo: z.string().min(1),
  config: z.unknown(),
  posicao: z.object({ x: z.number(), y: z.number() }),
});

const edgeSchema = z.object({ id: z.string().min(1), from: z.string().min(1), to: z.string().min(1) });

const bodySchema = z.object({
  nome: z.string().min(1),
  ativo: z.boolean().default(true),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema).default([]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const validacao = validarFluxo(parsed.data.nodes as unknown as FlowGrafoNode[], parsed.data.edges);
  if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 });

  const { data, error } = await supabase
    .from("automation_flows")
    .insert({
      user_id: user.id, nome: parsed.data.nome, ativo: parsed.data.ativo,
      nodes: parsed.data.nodes as Json, edges: parsed.data.edges as Json,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível criar o fluxo." }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
