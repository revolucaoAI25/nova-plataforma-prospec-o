import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { asaasConfigurado } from "@/lib/integrations/asaas";
import { criarCompra } from "@/lib/credit-purchases-db";

const bodySchema = z.object({
  packageId: z.string().uuid(),
  // Só 11 (CPF) ou 14 (CNPJ) dígitos, sem pontuação — validado no cliente
  // antes de enviar; aqui só garante que não veio lixo.
  cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/).optional(),
});

export async function POST(request: Request) {
  if (!(await asaasConfigurado())) {
    return NextResponse.json({ error: "Compra de créditos ainda não está configurada." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  if (!profile.asaas_customer_id && !profile.cpf_cnpj && !parsed.data.cpfCnpj) {
    return NextResponse.json({ error: "Informe seu CPF ou CNPJ pra continuar." }, { status: 400 });
  }

  // RLS de `credit_packages` já garante que só pacotes ativos são
  // legíveis — pacote inexistente/inativo simplesmente não retorna aqui.
  const { data: pacote } = await supabase.from("credit_packages").select("*").eq("id", parsed.data.packageId).eq("ativo", true).maybeSingle();
  if (!pacote) return NextResponse.json({ error: "Pacote não encontrado." }, { status: 404 });

  try {
    const { invoiceUrl } = await criarCompra(supabase, profile, pacote, parsed.data.cpfCnpj || null);
    return NextResponse.json({ invoiceUrl });
  } catch (err) {
    console.error("[creditos/comprar]", err);
    return NextResponse.json({ error: "Não foi possível iniciar a compra. Tente novamente em instantes." }, { status: 502 });
  }
}
