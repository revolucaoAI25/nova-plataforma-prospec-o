import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterCampanha, registrarOptOut } from "@/lib/dispatch-db";

/**
 * Remove um alvo específico da campanha e registra opt-out — único jeito
 * hoje de um lead parar de receber mensagens antes do fim da cadência (sem
 * isso, `dispatch_opt_outs` nunca era escrita por nada: nenhum lead saía
 * de uma campanha ativa sozinho). O opt-out é por telefone+usuário, então
 * vale pra qualquer campanha futura desse dono também, não só esta.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; targetId: string }> },
) {
  const { id, targetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const campanha = await obterCampanha(supabase, id);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  const { data: target } = await supabase
    .from("dispatch_targets")
    .select("id, telefone")
    .eq("id", targetId)
    .eq("campaign_id", id)
    .single();
  if (!target) return NextResponse.json({ error: "Alvo não encontrado." }, { status: 404 });

  const { error } = await supabase
    .from("dispatch_targets")
    .update({ status: "removido", atualizado_em: new Date().toISOString() })
    .eq("id", targetId);
  if (error) return NextResponse.json({ error: "Não foi possível remover o alvo." }, { status: 500 });

  await registrarOptOut(supabase, target.telefone, campanha.user_id, "Removido manualmente pelo usuário");

  // Opt-out vale imediatamente pra qualquer outra campanha ativa desse
  // mesmo dono — não só a partir da próxima inscrição. Sem isso, um lead
  // que já estava pendente numa campanha B continuaria recebendo mensagens
  // mesmo tendo sido removido explicitamente na campanha A.
  const { data: outrasCampanhas } = await supabase.from("dispatch_campaigns").select("id").eq("user_id", campanha.user_id);
  const idsCampanhas = (outrasCampanhas || []).map((c) => c.id as string);
  if (idsCampanhas.length) {
    await supabase
      .from("dispatch_targets")
      .update({ status: "removido", atualizado_em: new Date().toISOString() })
      .eq("telefone", target.telefone)
      .in("campaign_id", idsCampanhas)
      .in("status", ["pendente", "enviando"]);
  }

  return NextResponse.json({ ok: true });
}
