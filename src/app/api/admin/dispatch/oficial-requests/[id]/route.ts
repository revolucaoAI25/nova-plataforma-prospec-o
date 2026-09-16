import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { atualizarSolicitacaoOficial } from "@/lib/dispatch-db";

const bodySchema = z.object({
  status: z.enum(["pendente", "em_andamento", "concluido"]).optional(),
  observacao: z.string().optional(),
  instanceId: z.string().uuid().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.status) campos.status = parsed.data.status;
  if (parsed.data.observacao !== undefined) campos.observacao = parsed.data.observacao;
  if (parsed.data.instanceId) campos.instance_id = parsed.data.instanceId;

  const ok = await atualizarSolicitacaoOficial(supabase, id, campos);
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar a solicitação." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
