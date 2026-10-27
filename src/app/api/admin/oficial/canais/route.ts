import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { ErroDatafy, listarCanais, parceiroDatafyConfigurado } from "@/lib/integrations/datafy-parceiro";
import { ErroCanalOficial, vincularCanalExistente } from "@/lib/whatsapp-oficial-canal";

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user && (await requireAdmin(supabase, user.id)));
}

const SEM_TOKEN = "Cadastre o token de conta de parceiro da Datafy em Administração → Chaves e integrações.";

/** Admin: canais da conta de parceiro da Datafy, com quem cada um está na plataforma (sem tokens). */
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  if (!(await parceiroDatafyConfigurado())) return NextResponse.json({ error: SEM_TOKEN }, { status: 503 });
  try {
    const canais = await listarCanais();
    const sb = createAdminClient();
    const { data: vinculos } = await sb
      .from("datafy_canais")
      .select("channel_id, user_id")
      .is("cancelado_em", null)
      .in("channel_id", canais.map((c) => c.id));
    const ids = [...new Set((vinculos ?? []).map((v) => v.user_id as string))];
    const { data: perfis } = ids.length ? await sb.from("profiles").select("id, email, nome").in("id", ids) : { data: [] };
    const nomes = new Map((perfis ?? []).map((p) => [p.id as string, (p.nome as string | null) || (p.email as string)]));
    const donos = new Map((vinculos ?? []).map((v) => [v.channel_id as string, nomes.get(v.user_id as string) ?? "outro cliente"]));
    return NextResponse.json({
      canais: canais.map((c) => ({
        id: c.id,
        nome: c.name || "Sem nome",
        assinado: c.subscribed,
        conectado: Boolean(c.phone_number_id),
        numero: c.display_name ?? null,
        cliente: donos.get(c.id) ?? null,
      })),
    });
  } catch (err) {
    console.error("[admin/oficial/canais]", (err as Error).message);
    return NextResponse.json({ error: err instanceof ErroDatafy ? err.message : "Não foi possível listar os canais." }, { status: 502 });
  }
}

/** Admin: entrega um canal da conta a um cliente e devolve o link de conexão (ou já conectado). */
export async function POST(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = z.object({ userId: z.string().uuid(), channelId: z.string().min(1).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha o cliente e o canal." }, { status: 400 });
  if (!(await parceiroDatafyConfigurado())) return NextResponse.json({ error: SEM_TOKEN }, { status: 503 });
  try {
    return NextResponse.json(await vincularCanalExistente(parsed.data.userId, parsed.data.channelId));
  } catch (err) {
    if (err instanceof ErroCanalOficial) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/oficial/canais] vincular", (err as Error).message);
    return NextResponse.json({ error: err instanceof ErroDatafy ? err.message : "Não foi possível vincular o canal." }, { status: 502 });
  }
}
