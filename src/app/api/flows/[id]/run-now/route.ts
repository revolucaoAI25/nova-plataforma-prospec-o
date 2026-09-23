import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dispararManualmente } from "@/lib/flow/flow-engine";
import type { AutomationFlowRow } from "@/lib/database.types";

const bodySchema = z.object({
  variaveis: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data } = await supabase.from("automation_flows").select("*").eq("id", id).single();
  const flow = data as AutomationFlowRow | null;
  if (!flow) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const variaveis = parsed.success ? parsed.data.variaveis : {};

  const resultado = await dispararManualmente(supabase, flow, variaveis);
  if (!resultado.ok) return NextResponse.json({ error: resultado.erro }, { status: 400 });
  return NextResponse.json({ ok: true, runId: resultado.runId });
}
