import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletarEtapaEmail } from "@/lib/email-dispatch-db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { stepId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const ok = await deletarEtapaEmail(supabase, stepId);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover a etapa." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
