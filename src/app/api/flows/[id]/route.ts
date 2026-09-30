import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validarEstruturaFluxo, validarFluxo, type FlowGrafoNode, type FlowGrafoEdge } from "@/lib/flow/node-types";
import type { AutomationFlowRow, Json } from "@/lib/database.types";

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

  const { data: atualData } = await supabase.from("automation_flows").select("*").eq("id", id).maybeSingle();
  const atual = atualData as AutomationFlowRow | null;
  if (!atual) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });

  // Estado resultante: o que veio no PATCH por cima do que está salvo. Um
  // fluxo ativo precisa estar completo (validação total); pausado, basta
  // a estrutura estar íntegra — dá pra salvar rascunho no meio da montagem.
  // Isso também fecha o "ativar" via PATCH {ativo:true} sem nós, que antes
  // não revalidava nada.
  const nodes = (parsed.data.nodes ?? atual.nodes) as unknown as FlowGrafoNode[];
  const edges = (parsed.data.edges ?? (parsed.data.nodes ? [] : atual.edges)) as unknown as FlowGrafoEdge[];
  const ativo = parsed.data.ativo ?? atual.ativo;
  const mudouGrafo = parsed.data.nodes !== undefined || parsed.data.edges !== undefined;
  if (mudouGrafo || (ativo && !atual.ativo)) {
    const estrutura = validarEstruturaFluxo(nodes, edges);
    if (!estrutura.ok) return NextResponse.json({ error: estrutura.erro }, { status: 400 });
    if (ativo) {
      const completo = validarFluxo(nodes, edges);
      if (!completo.ok) return NextResponse.json({ error: `Pra ativar, o fluxo precisa estar completo — ${completo.erro}` }, { status: 400 });
    }
  }

  const campos: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) campos.nome = parsed.data.nome;
  if (parsed.data.ativo !== undefined) campos.ativo = parsed.data.ativo;
  if (mudouGrafo) {
    campos.nodes = nodes as unknown as Json;
    campos.edges = edges as unknown as Json;
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
