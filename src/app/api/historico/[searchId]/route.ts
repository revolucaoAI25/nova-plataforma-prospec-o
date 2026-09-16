import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletarPesquisa } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const { searchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { ok, erro } = await deletarPesquisa(supabase, searchId);
  if (!ok) return NextResponse.json({ error: erro || "Não foi possível remover a pesquisa." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
