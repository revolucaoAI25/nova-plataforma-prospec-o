import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { gerarFluxoComIa } from "@/lib/flow/gerar-ia";
import type { Json } from "@/lib/database.types";

export const maxDuration = 300;

const LIMITE_POR_DIA = 20;

const bodySchema = z.object({
  descricao: z.string().trim().min(15, "Descreva a estratégia com um pouco mais de detalhe.").max(4000),
});

/** Monta um fluxo a partir da estratégia descrita em texto e salva como rascunho pausado. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  const desde = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase
    .from("flow_geracoes_ia")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("criado_em", desde);
  if ((count ?? 0) >= LIMITE_POR_DIA && profile.role !== "admin") {
    return NextResponse.json({ error: `Você já criou ${LIMITE_POR_DIA} fluxos com IA nas últimas 24 horas. Tente de novo amanhã.` }, { status: 429 });
  }

  const { data: registro } = await supabase
    .from("flow_geracoes_ia")
    .insert({ user_id: user.id, descricao: parsed.data.descricao })
    .select("id")
    .single();

  try {
    const fluxo = await gerarFluxoComIa(supabase, profile, parsed.data.descricao);
    const { data, error } = await supabase
      .from("automation_flows")
      .insert({ user_id: user.id, nome: fluxo.nome, ativo: false, nodes: fluxo.nodes as unknown as Json, edges: fluxo.edges as unknown as Json })
      .select("id")
      .single();
    if (error || !data) throw new Error("Não foi possível salvar o fluxo gerado.");
    if (registro) await supabase.from("flow_geracoes_ia").update({ flow_id: data.id }).eq("id", registro.id);
    return NextResponse.json({ id: data.id, explicacao: fluxo.explicacao, oQueFalta: fluxo.oQueFalta }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || "Falha ao gerar o fluxo.";
    if (registro) await supabase.from("flow_geracoes_ia").update({ erro: msg.slice(0, 500) }).eq("id", registro.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
