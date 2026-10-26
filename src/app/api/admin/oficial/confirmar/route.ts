import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { ErroDatafy } from "@/lib/integrations/datafy-parceiro";
import { ErroCanalOficial, confirmarConexaoOficial } from "@/lib/whatsapp-oficial-canal";

/** Admin: confere na Datafy se o número do cliente já foi conectado e libera o canal. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = z.object({ userId: z.string().uuid(), instanceId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json(await confirmarConexaoOficial(parsed.data.userId, parsed.data.instanceId, { porAdmin: true }));
  } catch (err) {
    if (err instanceof ErroCanalOficial) return NextResponse.json({ error: err.message }, { status: err.status });
    const msg = err instanceof ErroDatafy ? err.message : "Não foi possível verificar.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
