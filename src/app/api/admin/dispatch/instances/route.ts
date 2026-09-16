import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { criarInstanciaOficial, atualizarSolicitacaoOficial } from "@/lib/dispatch-db";

const bodySchema = z.object({
  userId: z.string().uuid(),
  nome: z.string().min(1),
  token: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().optional(),
  numeroConectado: z.string().optional(),
  solicitacaoId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const instanceId = await criarInstanciaOficial(
    supabase, parsed.data.userId, parsed.data.nome, parsed.data.token,
    parsed.data.phoneNumberId, parsed.data.wabaId, parsed.data.numeroConectado,
  );
  if (!instanceId) return NextResponse.json({ error: "Não foi possível provisionar a instância." }, { status: 500 });

  if (parsed.data.solicitacaoId) {
    await atualizarSolicitacaoOficial(supabase, parsed.data.solicitacaoId, { status: "concluido", instance_id: instanceId });
  }

  return NextResponse.json({ id: instanceId }, { status: 201 });
}
