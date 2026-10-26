import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { COLUNAS_LEAD } from "@/lib/lp-leads-tipos";

async function soAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user && (await requireAdmin(supabase, user.id)));
}

const schema = z.object({
  coluna: z.enum(COLUNAS_LEAD.map((c) => c.id) as [string, ...string[]]).optional(),
  notas: z.string().max(4000).optional(),
});

/** Move o lead no quadro e/ou salva as anotações. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await soAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const agora = new Date().toISOString();
  const campos: Record<string, unknown> = { atualizado_em: agora };
  if (parsed.data.coluna) Object.assign(campos, { coluna: parsed.data.coluna, movido_em: agora });
  if (parsed.data.notas !== undefined) campos.notas = parsed.data.notas.trim() || null;

  const { error } = await createAdminClient().from("lp_leads").update(campos).eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Remove um lead do quadro (ex.: teste interno, dados falsos). Não mexe na conta da pessoa. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await soAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const { id } = await params;
  const { error } = await createAdminClient().from("lp_leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível remover." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
