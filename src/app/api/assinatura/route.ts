import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { asaasConfigurado } from "@/lib/integrations/asaas";
import { listarPlanosAtivos, assinarPlano, cancelarPlano } from "@/lib/subscriptions-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  const planos = await listarPlanosAtivos(supabase);
  return NextResponse.json({
    planos,
    assinatura: { status: profile.assinatura_status, planoId: profile.plano_id, ciclo: profile.assinatura_ciclo },
  });
}

const bodySchema = z.object({
  planId: z.string().uuid(),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/).optional(),
});

export async function POST(request: Request) {
  if (!(await asaasConfigurado())) {
    return NextResponse.json({ error: "Assinatura de plano ainda não está configurada." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  if (profile.assinatura_status === "ativa" || profile.assinatura_status === "pendente") {
    return NextResponse.json({ error: "Você já tem uma assinatura ativa. Cancele antes de assinar outro plano." }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  if (!profile.asaas_customer_id && !profile.cpf_cnpj && !parsed.data.cpfCnpj) {
    return NextResponse.json({ error: "Informe seu CPF ou CNPJ pra continuar." }, { status: 400 });
  }

  const { data: plano } = await supabase.from("plans").select("*").eq("id", parsed.data.planId).eq("ativo", true).maybeSingle();
  if (!plano) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  try {
    const { invoiceUrl } = await assinarPlano(supabase, profile, plano, parsed.data.cpfCnpj || null, parsed.data.ciclo);
    return NextResponse.json({ invoiceUrl });
  } catch (err) {
    console.error("[assinatura POST]", err);
    return NextResponse.json({ error: "Não foi possível iniciar a assinatura. Tente novamente em instantes." }, { status: 502 });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  try {
    await cancelarPlano(supabase, profile);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[assinatura DELETE]", err);
    return NextResponse.json({ error: "Não foi possível cancelar a assinatura agora. Tente novamente." }, { status: 502 });
  }
}
