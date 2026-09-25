import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listarTargetsCampanhaEmail } from "@/lib/email-dispatch-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const targets = await listarTargetsCampanhaEmail(supabase, id);
  return NextResponse.json({ targets });
}
