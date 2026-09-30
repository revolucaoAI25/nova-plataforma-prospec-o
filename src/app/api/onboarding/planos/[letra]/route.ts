import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { listarAplicacoes, obterOnboarding } from "@/lib/onboarding/db";
import { aplicarPlano, ativarPlano, checklistDoPlano, pausarPlano } from "@/lib/onboarding/aplicar";
import { CENARIOS } from "@/lib/onboarding/cenarios";

async function contexto(letra: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) } as const;

  const admin = createAdminClient();
  const [profile, onboarding, aplicacoes] = await Promise.all([
    getProfile(admin, user.id),
    obterOnboarding(admin, user.id),
    listarAplicacoes(admin, user.id),
  ]);
  const plano = onboarding?.resultado?.planos.find((p) => p.letra === letra);
  if (!profile || !plano) return { erro: NextResponse.json({ error: "Plano não encontrado." }, { status: 404 }) } as const;
  const aplicacao = aplicacoes.find((a) => a.letra === letra) ?? null;
  return { admin, profile, plano, aplicacao } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ letra: string }> }) {
  const { letra } = await params;
  const ctx = await contexto(letra);
  if ("erro" in ctx) return ctx.erro;
  const passos = await checklistDoPlano(ctx.admin, ctx.profile, ctx.plano, ctx.aplicacao);
  return NextResponse.json({ aplicacao: ctx.aplicacao, passos });
}

const bodySchema = z.object({ acao: z.enum(["aplicar", "ativar", "pausar"]) });

export async function POST(request: Request, { params }: { params: Promise<{ letra: string }> }) {
  const { letra } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

  const ctx = await contexto(letra);
  if ("erro" in ctx) return ctx.erro;
  const { admin, profile, plano } = ctx;

  try {
    if (parsed.data.acao === "aplicar") {
      const cenario = CENARIOS[plano.cenarioId];
      const liberado = profile.role === "admin" || cenario.recursos.every((r) => profile[r] && !(profile.conta_teste && r === "linkedin_disparo_habilitado"));
      if (!liberado) return NextResponse.json({ error: "Seu plano atual não inclui todos os recursos deste plano de prospecção." }, { status: 403 });
      const aplicacao = await aplicarPlano(admin, profile.id, plano);
      return NextResponse.json({ aplicacao, passos: await checklistDoPlano(admin, profile, plano, aplicacao) });
    }
    if (!ctx.aplicacao) return NextResponse.json({ error: "Use este plano antes de ativá-lo." }, { status: 400 });
    if (parsed.data.acao === "ativar") await ativarPlano(admin, profile, plano, ctx.aplicacao);
    else await pausarPlano(admin, ctx.aplicacao);

    const [atualizada] = (await listarAplicacoes(admin, profile.id)).filter((a) => a.letra === letra);
    return NextResponse.json({ aplicacao: atualizada, passos: await checklistDoPlano(admin, profile, plano, atualizada ?? null) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível concluir a ação." }, { status: 400 });
  }
}
