import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ErroCanalOficial, confirmarConexaoOficial } from "@/lib/whatsapp-oficial-canal";

/** Depois da janela de conexão (ou no "Verificar conexão"): confere na Datafy e libera o número. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = z.object({ instanceId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json(await confirmarConexaoOficial(user.id, parsed.data.instanceId));
  } catch (err) {
    if (err instanceof ErroCanalOficial) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[oficial/confirmar]", (err as Error).message);
    return NextResponse.json({ error: "Não foi possível verificar a conexão agora. Tente novamente em instantes." }, { status: 502 });
  }
}
