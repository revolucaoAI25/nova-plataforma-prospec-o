import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reexecutarRun } from "@/lib/flow/flow-engine";

/** Retry manual — só funciona numa run com status 'erro' (RLS + o filtro .eq("status","erro") em reexecutarRun cuidam de IDOR e de não reiniciar uma run que já está rodando). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: run } = await supabase.from("flow_runs").select("id").eq("id", runId).eq("flow_id", id).maybeSingle();
  if (!run) return NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });

  const ok = await reexecutarRun(supabase, runId);
  if (!ok) return NextResponse.json({ error: "Essa execução não está com erro (ou já foi reiniciada)." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
