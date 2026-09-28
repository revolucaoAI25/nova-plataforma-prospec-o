import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterRunBigDataCorp, listarLeadsRunBigDataCorp, deletarRunBigDataCorp } from "@/lib/bigdatacorp-enrichment-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const run = await obterRunBigDataCorp(supabase, id);
  if (!run) return NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });

  const leads = await listarLeadsRunBigDataCorp(supabase, id);
  return NextResponse.json({ run, leads });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const ok = await deletarRunBigDataCorp(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover a execução." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
