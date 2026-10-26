import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

/** Marca um aviso do admin como resolvido (some do topo das telas). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  }
  const parsed = z.object({ id: z.number().int().positive() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Aviso inválido." }, { status: 400 });

  const { error } = await createAdminClient()
    .from("alertas_admin")
    .update({ resolvido_em: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "Não foi possível marcar o aviso." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
