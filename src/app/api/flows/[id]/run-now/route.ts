import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispararManualmente } from "@/lib/flow/flow-engine";
import type { AutomationFlowRow } from "@/lib/database.types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data } = await supabase.from("automation_flows").select("*").eq("id", id).single();
  const flow = data as AutomationFlowRow | null;
  if (!flow) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });

  const resultado = await dispararManualmente(supabase, flow);
  if (!resultado.ok) return NextResponse.json({ error: resultado.erro }, { status: 400 });
  return NextResponse.json({ ok: true, runId: resultado.runId });
}
