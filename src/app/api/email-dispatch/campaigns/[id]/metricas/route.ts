import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { metricasCampanha } from "@/lib/metricas-disparo";

/** Funil enviado → entregue → lido → respondeu, teste A/B e desempenho por etapa (RLS limita ao dono). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const metricas = await metricasCampanha(supabase, "email", id);
  return NextResponse.json({ metricas });
}
