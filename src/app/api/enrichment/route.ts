import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import type { EnrichmentOpcoes } from "@/lib/database.types";

const LIMITE_LOTE = 50;

const leadSchema = z.object({
  nome: z.string().default(""),
  email: z.string().default(""),
  telefone: z.string().default(""),
});

const bodySchema = z.object({
  leads: z.array(leadSchema).min(1).max(LIMITE_LOTE),
  nivelRaciocinio: z.enum(["rapido", "equilibrado", "profundo"]).default("equilibrado"),
  buscarSocios: z.boolean().default(true),
  buscarFundacao: z.boolean().default(true),
  buscarProcessos: z.boolean().default(true),
  camposCustomizados: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(profile.enriquecimento_ia_habilitado || profile.role === "admin")) {
    return NextResponse.json({ error: "O Enriquecimento de Leads via IA não está habilitado para sua conta." }, { status: 403 });
  }
  if (!profile.openai_api_key) {
    return NextResponse.json(
      { error: "Você precisa cadastrar sua própria chave da OpenAI antes de usar esse recurso — vá em Configurações." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });
  }
  const filtros = parsed.data;

  const leadsValidos = filtros.leads.filter((l) => l.email.trim() || l.telefone.trim());
  if (!leadsValidos.length) {
    return NextResponse.json({ error: "Nenhum lead com e-mail ou telefone pra buscar." }, { status: 400 });
  }
  const lote = leadsValidos.slice(0, LIMITE_LOTE);

  const opcoes: EnrichmentOpcoes = {
    nivelRaciocinio: filtros.nivelRaciocinio,
    buscarSocios: filtros.buscarSocios,
    buscarFundacao: filtros.buscarFundacao,
    buscarProcessos: filtros.buscarProcessos,
    camposCustomizados: filtros.camposCustomizados.map((c) => c.trim()).filter(Boolean),
  };

  const { data: run, error: runError } = await supabase
    .from("enrichment_runs")
    .insert({ user_id: user.id, status: "pendente", total: lote.length, opcoes })
    .select()
    .single();
  if (runError || !run) {
    return NextResponse.json({ error: "Não foi possível criar a execução." }, { status: 500 });
  }

  const linhas = lote.map((l) => ({
    run_id: run.id,
    user_id: user.id,
    nome_lead: l.nome.trim(),
    email: l.email.trim(),
    telefone: l.telefone.trim(),
    status: "pendente" as const,
  }));
  const { error: leadsError } = await supabase.from("enrichment_leads").insert(linhas);
  if (leadsError) {
    await supabase.from("enrichment_runs").delete().eq("id", run.id);
    return NextResponse.json({ error: "Não foi possível salvar os leads da execução." }, { status: 500 });
  }

  // O worker (tickEnrichment, a cada ~10s) pega execuções "pendente" e
  // processa em background — evita depender de manter esta requisição HTTP
  // aberta por vários minutos (cada lead pode levar até 240s, lote até 50).
  return NextResponse.json({ runId: run.id }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("enrichment_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data });
}
