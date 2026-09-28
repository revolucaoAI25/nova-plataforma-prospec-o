import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterCampanhaLinkedin, registrarOptOutLinkedin } from "@/lib/linkedin-dispatch-db";

/**
 * Remove um alvo específico da campanha e registra opt-out — mirror exato
 * da rota equivalente dos outros dois canais. O opt-out é por
 * linkedin_url+usuário, então vale pra qualquer campanha futura desse
 * dono também, não só esta.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; targetId: string }> },
) {
  const { id, targetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const campanha = await obterCampanhaLinkedin(supabase, id);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  const { data: target } = await supabase
    .from("linkedin_targets")
    .select("id, linkedin_url")
    .eq("id", targetId)
    .eq("campaign_id", id)
    .single();
  if (!target) return NextResponse.json({ error: "Alvo não encontrado." }, { status: 404 });

  const { error } = await supabase
    .from("linkedin_targets")
    .update({ status: "removido", atualizado_em: new Date().toISOString() })
    .eq("id", targetId);
  if (error) return NextResponse.json({ error: "Não foi possível remover o alvo." }, { status: 500 });

  await registrarOptOutLinkedin(supabase, target.linkedin_url, campanha.user_id, "Removido manualmente pelo usuário");

  const { data: outrasCampanhas } = await supabase.from("linkedin_campaigns").select("id").eq("user_id", campanha.user_id);
  const idsCampanhas = (outrasCampanhas || []).map((c) => c.id as string);
  if (idsCampanhas.length) {
    await supabase
      .from("linkedin_targets")
      .update({ status: "removido", atualizado_em: new Date().toISOString() })
      .eq("linkedin_url", target.linkedin_url)
      .in("campaign_id", idsCampanhas)
      .in("status", ["pendente", "enviando", "aguardando_aceite"]);
  }

  return NextResponse.json({ ok: true });
}
