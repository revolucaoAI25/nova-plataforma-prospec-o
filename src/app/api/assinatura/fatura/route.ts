import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterFaturaEmAberto } from "@/lib/integrations/asaas";

/** Link da fatura em aberto da assinatura do próprio usuário (pagamento recusado ou pendente). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: perfil } = await supabase.from("profiles").select("asaas_subscription_id").eq("id", user.id).maybeSingle();
  const assinaturaId = (perfil as { asaas_subscription_id: string | null } | null)?.asaas_subscription_id;
  if (!assinaturaId) return NextResponse.json({ error: "Não há assinatura em aberto. Escolha um plano em Planos e créditos." }, { status: 404 });

  try {
    const fatura = await obterFaturaEmAberto(assinaturaId);
    if (!fatura) return NextResponse.json({ error: "Não há fatura em aberto. Se você acabou de pagar, a liberação acontece em instantes." }, { status: 404 });
    return NextResponse.json({ invoiceUrl: fatura.invoiceUrl });
  } catch (err) {
    console.error("[assinatura/fatura]", err);
    return NextResponse.json({ error: "Não foi possível abrir a fatura agora. Tente de novo em instantes." }, { status: 502 });
  }
}
