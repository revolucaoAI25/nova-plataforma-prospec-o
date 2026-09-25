import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterCampanhaEmail, registrarOptOutEmail } from "@/lib/email-dispatch-db";

/**
 * Remove um alvo específico da campanha e registra opt-out — mirror exato
 * da rota equivalente do disparo WhatsApp. O opt-out é por e-mail+usuário,
 * então vale pra qualquer campanha futura desse dono também, não só esta.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; targetId: string }> },
) {
  const { id, targetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const campanha = await obterCampanhaEmail(supabase, id);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  const { data: target } = await supabase
    .from("email_targets")
    .select("id, email")
    .eq("id", targetId)
    .eq("campaign_id", id)
    .single();
  if (!target) return NextResponse.json({ error: "Alvo não encontrado." }, { status: 404 });

  const { error } = await supabase
    .from("email_targets")
    .update({ status: "removido", atualizado_em: new Date().toISOString() })
    .eq("id", targetId);
  if (error) return NextResponse.json({ error: "Não foi possível remover o alvo." }, { status: 500 });

  await registrarOptOutEmail(supabase, target.email, campanha.user_id, "Removido manualmente pelo usuário");

  // Opt-out vale imediatamente pra qualquer outra campanha ativa desse
  // mesmo dono — não só a partir da próxima inscrição.
  const { data: outrasCampanhas } = await supabase.from("email_campaigns").select("id").eq("user_id", campanha.user_id);
  const idsCampanhas = (outrasCampanhas || []).map((c) => c.id as string);
  if (idsCampanhas.length) {
    await supabase
      .from("email_targets")
      .update({ status: "removido", atualizado_em: new Date().toISOString() })
      .eq("email", target.email)
      .in("campaign_id", idsCampanhas)
      .in("status", ["pendente", "enviando"]);
  }

  return NextResponse.json({ ok: true });
}
