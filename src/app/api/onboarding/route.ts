import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { respostasSchema } from "@/lib/onboarding/questionario";
import { listarAplicacoes, obterOnboarding } from "@/lib/onboarding/db";

// Escrita sempre pelo cliente admin (a tabela não tem policy de escrita pro
// usuário) — a identidade vem da sessão, nunca do corpo da requisição.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const [onboarding, aplicacoes] = await Promise.all([obterOnboarding(admin, user.id), listarAplicacoes(admin, user.id)]);
  return NextResponse.json({
    status: onboarding?.status ?? "rascunho",
    respostas: onboarding?.respostas ?? {},
    resultado: onboarding?.resultado ?? null,
    erro: onboarding?.erro ?? null,
    aplicacoes,
  });
}

const putSchema = z.object({ respostas: respostasSchema });

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Respostas inválidas." }, { status: 400 });

  const admin = createAdminClient();
  const atual = await obterOnboarding(admin, user.id);
  if (atual?.status === "gerando") {
    return NextResponse.json({ error: "Seus planos estão sendo montados agora — aguarde terminar pra editar as respostas." }, { status: 409 });
  }

  const { error } = await admin.from("onboarding").upsert(
    {
      user_id: user.id,
      respostas: parsed.data.respostas,
      // Editar respostas depois de gerado não apaga os planos atuais: o
      // cliente decide se quer gerar de novo.
      status: atual?.status === "pronto" ? "pronto" : "rascunho",
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return NextResponse.json({ error: "Não foi possível salvar suas respostas." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
