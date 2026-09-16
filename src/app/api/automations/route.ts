import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarAutomacoesUsuario, criarAutomacao } from "@/lib/automation-db";
import { calcularProximaExecucao } from "@/lib/automation-logic";
import type { Json } from "@/lib/database.types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const automacoes = await listarAutomacoesUsuario(supabase, user.id);
  return NextResponse.json({ automacoes });
}

const bodySchema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["cnpj", "maps"]),
  filtros: z.record(z.string(), z.unknown()),
  sheetId: z.string().optional(),
  sheetAba: z.string().optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).min(1),
  horario: z.string().min(1),
  dispatchCampaignId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const proxima = calcularProximaExecucao(parsed.data.diasSemana, parsed.data.horario);
  const id = await criarAutomacao(supabase, user.id, {
    ...parsed.data,
    filtros: parsed.data.filtros as Json,
    proximaExecucao: proxima?.toISOString() || null,
  });
  if (!id) return NextResponse.json({ error: "Não foi possível criar a automação." }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}
