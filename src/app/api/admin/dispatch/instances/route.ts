import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { criarInstanciaOficial, atualizarSolicitacaoOficial } from "@/lib/dispatch-db";
import { dadosContaDatafy } from "@/lib/integrations/whatsapp-oficial";

const bodySchema = z.object({
  userId: z.string().uuid(),
  nome: z.string().min(1),
  token: z.string().min(1),
  phoneNumberId: z.string().optional(),
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

  // Confere o token na Datafy e usa os IDs que ela devolve (os digitados só
  // valem se baterem; um ID trocado faria todo envio voltar 403).
  const token = parsed.data.token.trim();
  let conta;
  try {
    conta = await dadosContaDatafy(token);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  const digitado = parsed.data.phoneNumberId?.trim();
  if (digitado && digitado !== conta.phoneNumberId) {
    return NextResponse.json({ error: `O Phone Number ID não bate com o token (a Datafy informa ${conta.phoneNumberId}). Deixe o campo vazio para usar o do token.` }, { status: 400 });
  }

  const instanceId = await criarInstanciaOficial(
    supabase, parsed.data.userId, parsed.data.nome, token,
    conta.phoneNumberId, parsed.data.wabaId?.trim() || conta.wabaId || undefined, parsed.data.numeroConectado,
  );
  if (!instanceId) return NextResponse.json({ error: "Não foi possível provisionar a instância." }, { status: 500 });

  if (parsed.data.solicitacaoId) {
    await atualizarSolicitacaoOficial(supabase, parsed.data.solicitacaoId, { status: "concluido", instance_id: instanceId });
  }

  return NextResponse.json({ id: instanceId }, { status: 201 });
}
