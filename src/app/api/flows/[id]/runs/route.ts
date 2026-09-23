import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: runs, error } = await supabase
    .from("flow_runs")
    .select("*")
    .eq("flow_id", id)
    .order("iniciado_em", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const runIds = (runs || []).map((r) => r.id as string);
  let steps: Record<string, unknown>[] = [];
  if (runIds.length) {
    const { data } = await supabase
      .from("flow_run_steps")
      .select("*")
      .in("run_id", runIds)
      .order("iniciado_em", { ascending: true });
    steps = data || [];
  }

  return NextResponse.json({ runs, steps });
}
