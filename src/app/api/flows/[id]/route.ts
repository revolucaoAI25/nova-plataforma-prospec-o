import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validarFluxo, type FlowGrafoNode } from "@/lib/flow/node-types";
import type { Json } from "@/lib/database.types";

const nodeSchema = z.object({
  id: z.string().min(1),
  tipo: z.string().min(1),
  config: z.unknown(),
  posicao: z.object({ x: z.number(), y: z.number() }),
});

const edgeSchema = z.object({ id: z.string().min(1), from: z.string().min(1), to: z.string().min(1) });

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  ativo: z.boolean().optional(),
  nodes: z.array(nodeSchema).min(1).optional(),
  edges: z.array(edgeSchema).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) campos.nome = parsed.data.nome;
  if (parsed.data.ativo !== undefined) campos.ativo = parsed.data.ativo;
  if (parsed.data.nodes !== undefined) {
    const edges = parsed.data.edges ?? [];
    const validacao = validarFluxo(parsed.data.nodes as unknown as FlowGrafoNode[], edges);
    if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 });
    campos.nodes = parsed.data.nodes as Json;
    campos.edges = edges as Json;
  } else if (parsed.data.edges !== undefined) {
    campos.edges = parsed.data.edges as Json;
  }
  campos.updated_at = new Date().toISOString();

  const { error } = await supabase.from("automation_flows").update(campos).eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível atualizar o fluxo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { error } = await supabase.from("automation_flows").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível remover o fluxo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
