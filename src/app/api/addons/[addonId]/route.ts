import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { asaasConfigurado } from "@/lib/integrations/asaas";
import { assinarAddon, cancelarAddon } from "@/lib/addons-db";
import type { UserAddonSubscriptionRow } from "@/lib/database.types";

const bodySchema = z.object({
  cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ addonId: string }> }) {
  const { addonId } = await params;
  if (!(await asaasConfigurado())) {
    return NextResponse.json({ error: "Assinatura de add-ons ainda não está configurada." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  const { data: assinaturaAtual } = await supabase
    .from("user_addon_subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .eq("addon_id", addonId)
    .maybeSingle();
  if (assinaturaAtual?.status === "ativa" || assinaturaAtual?.status === "pendente" || assinaturaAtual?.status === "inadimplente") {
    // Inclui "inadimplente" de propósito — mesmo motivo do bloqueio
    // equivalente em /api/assinatura: `assinarAddon` faz upsert em
    // (user_id, addon_id) e sobrescreve `asaas_subscription_id`, deixando
    // a assinatura antiga (com cobrança vencida, mas ainda ativa no
    // Asaas) órfã e sem cancelar — continua cobrando o cliente sem que
    // nenhum webhook futuro dela bata com nada no nosso banco.
    return NextResponse.json({ error: "Você já tem uma assinatura desse add-on em aberto. Cancele antes de assinar de novo." }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  if (!profile.asaas_customer_id && !profile.cpf_cnpj && !parsed.data.cpfCnpj) {
    return NextResponse.json({ error: "Informe seu CPF ou CNPJ pra continuar." }, { status: 400 });
  }

  const { data: addon } = await supabase.from("addons").select("*").eq("id", addonId).eq("ativo", true).maybeSingle();
  if (!addon) return NextResponse.json({ error: "Add-on não encontrado." }, { status: 404 });

  try {
    const { invoiceUrl } = await assinarAddon(supabase, profile, addon, parsed.data.cpfCnpj || null);
    return NextResponse.json({ invoiceUrl });
  } catch (err) {
    console.error("[addons POST]", err);
    return NextResponse.json({ error: "Não foi possível iniciar a assinatura do add-on. Tente novamente em instantes." }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ addonId: string }> }) {
  const { addonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data } = await supabase
    .from("user_addon_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("addon_id", addonId)
    .maybeSingle();
  const assinatura = data as UserAddonSubscriptionRow | null;
  if (!assinatura) return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });

  try {
    await cancelarAddon(supabase, assinatura);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[addons DELETE]", err);
    return NextResponse.json({ error: "Não foi possível cancelar a assinatura agora. Tente novamente." }, { status: 502 });
  }
}
