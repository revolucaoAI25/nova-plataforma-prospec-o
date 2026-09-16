import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { atualizarAutomacao, deletarAutomacao } from "@/lib/automation-db";
import { calcularProximaExecucao } from "@/lib/automation-logic";

const patchSchema = z.object({
  ativa: z.boolean().optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).optional(),
  horario: z.string().optional(),
  sheetId: z.string().optional(),
  sheetAba: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.ativa !== undefined) campos.ativa = parsed.data.ativa;
  if (parsed.data.sheetId !== undefined) campos.sheet_id = parsed.data.sheetId || null;
  if (parsed.data.sheetAba !== undefined) campos.sheet_aba = parsed.data.sheetAba;
  if (parsed.data.diasSemana || parsed.data.horario) {
    campos.dias_semana = parsed.data.diasSemana;
    campos.horario = parsed.data.horario;
    if (parsed.data.diasSemana && parsed.data.horario) {
      const proxima = calcularProximaExecucao(parsed.data.diasSemana, parsed.data.horario);
      if (proxima) campos.proxima_execucao = proxima.toISOString();
    }
  }

  const ok = await atualizarAutomacao(supabase, id, campos);
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar a automação." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const ok = await deletarAutomacao(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover a automação." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
