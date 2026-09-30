import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { listarAplicacoes, obterOnboarding } from "@/lib/onboarding/db";
import { checklistDoPlano } from "@/lib/onboarding/aplicar";

/** Plano em configuração mais recente + seus passos — alimenta o guia flutuante em qualquer tela. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ guia: null }, { status: 401 });

  const admin = createAdminClient();
  const aplicacoes = await listarAplicacoes(admin, user.id);
  const emConfiguracao = aplicacoes
    .filter((a) => a.status === "aguardando_conexoes")
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
  if (!emConfiguracao) return NextResponse.json({ guia: null });

  const [profile, onboarding] = await Promise.all([getProfile(admin, user.id), obterOnboarding(admin, user.id)]);
  const plano = onboarding?.resultado?.planos.find((p) => p.letra === emConfiguracao.letra);
  if (!profile || !plano) return NextResponse.json({ guia: null });

  const passos = await checklistDoPlano(admin, profile, plano, emConfiguracao);
  return NextResponse.json({ guia: { letra: plano.letra, titulo: plano.titulo, passos } });
}
