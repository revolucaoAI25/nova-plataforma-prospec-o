import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { ErroDatafy, parceiroDatafyConfigurado } from "@/lib/integrations/datafy-parceiro";
import { ErroCanalOficial, iniciarConexaoOficial } from "@/lib/whatsapp-oficial-canal";

/** Admin: gera a conexão do WhatsApp oficial de um cliente (link para abrir agora ou enviar a ele). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha um cliente." }, { status: 400 });
  if (!(await parceiroDatafyConfigurado())) {
    return NextResponse.json({ error: "Cadastre o token de conta de parceiro da Datafy em /admin → Chaves da plataforma." }, { status: 503 });
  }
  try {
    return NextResponse.json(await iniciarConexaoOficial(parsed.data.userId, { porAdmin: true }));
  } catch (err) {
    if (err instanceof ErroCanalOficial) return NextResponse.json({ error: err.message }, { status: err.status });
    const msg = err instanceof ErroDatafy ? err.message : "Não foi possível gerar a conexão.";
    console.error("[admin/oficial/conectar]", (err as Error).message);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
