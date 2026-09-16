import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reservarAutomacao, executarAutomacao } from "@/lib/automation-runner";
import type { AutomationRow } from "@/lib/database.types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data } = await supabase.from("automations").select("*").eq("id", id).single();
  const auto = data as AutomationRow | null;
  if (!auto) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });

  await reservarAutomacao(supabase, auto);
  await executarAutomacao(supabase, auto);

  return NextResponse.json({ ok: true });
}
