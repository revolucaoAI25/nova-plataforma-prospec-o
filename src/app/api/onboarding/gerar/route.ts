import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterOnboarding } from "@/lib/onboarding/db";
import { pendenciasParaGerar, respostasSchema } from "@/lib/onboarding/questionario";

// Intervalo mínimo entre gerações — cada uma são 2 a 4 chamadas de IA pagas
// pela plataforma.
const INTERVALO_MIN_MS = 3 * 60_000;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const atual = await obterOnboarding(admin, user.id);
  if (!atual) return NextResponse.json({ error: "Responda o questionário primeiro." }, { status: 400 });
  if (atual.status === "gerando") return NextResponse.json({ ok: true, status: "gerando" });

  if (atual.solicitado_em && Date.now() - new Date(atual.solicitado_em).getTime() < INTERVALO_MIN_MS) {
    return NextResponse.json({ error: "Você acabou de gerar suas sugestões. Aguarde alguns minutos pra gerar de novo." }, { status: 429 });
  }

  const respostas = respostasSchema.parse(atual.respostas ?? {});
  const pendentes = pendenciasParaGerar(respostas);
  if (pendentes.length) {
    return NextResponse.json(
      { error: `Faltam respostas obrigatórias: ${pendentes.map((p) => p.label).join("; ")}.`, pendentes: pendentes.map((p) => p.id) },
      { status: 400 },
    );
  }

  const agora = new Date().toISOString();
  const { error } = await admin
    .from("onboarding")
    .update({ status: "gerando", erro: null, tentativas: 0, solicitado_em: agora, processando_desde: null, atualizado_em: agora })
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Não foi possível iniciar a geração." }, { status: 500 });
  return NextResponse.json({ ok: true, status: "gerando" }, { status: 202 });
}
