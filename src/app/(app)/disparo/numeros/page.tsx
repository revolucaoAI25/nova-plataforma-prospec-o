import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { listarInstancias } from "@/lib/dispatch-db";
import { PageHeader } from "@/components/layout/page-header";
import { NumerosWhatsapp } from "@/components/dispatch/numeros-whatsapp";
import type { InstanciaOficialResumo } from "@/components/dispatch/conectar-oficial";
import { emTesteGratis } from "@/lib/teste-gratis-regras";
import { parceiroDatafyConfigurado } from "@/lib/integrations/datafy-parceiro";
import { podeUsarOficial } from "@/lib/whatsapp-oficial-canal";

export const metadata = { title: "Números de WhatsApp" };

/** Onde a pessoa conecta os números que disparam: pelo QR Code ou pela API oficial. */
export default async function NumerosWhatsappPage({ searchParams }: { searchParams: Promise<{ oficial?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  // No teste grátis a página abre em modo de visualização (PortaoTesteGratis).
  if (!profile || (!profile.disparo_habilitado && profile.role !== "admin" && !emTesteGratis(profile))) redirect("/");

  const { oficial: abrir } = await searchParams;
  const [instancias, disponivel] = await Promise.all([listarInstancias(supabase, user.id), parceiroDatafyConfigurado()]);

  // Canais oficiais conectados pela própria pessoa (para "Concluir conexão" e "Reativar").
  let oficiais: InstanciaOficialResumo[] = [];
  if (disponivel) {
    const { data: canais } = await createAdminClient().from("datafy_canais").select("instance_id").eq("user_id", user.id).is("cancelado_em", null);
    const ids = new Set(((canais ?? []) as { instance_id: string | null }[]).map((c) => c.instance_id).filter(Boolean));
    oficiais = instancias.filter((i) => ids.has(i.id)).map((i) => ({ id: i.id, status: i.status, numero_conectado: i.numero_conectado, nome: i.nome }));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/disparo"
        eyebrow="Disparo WhatsApp"
        title="Números de WhatsApp"
        description="Conecte os números que enviam as suas campanhas: pelo QR Code, em 1 minuto, ou pela API oficial do WhatsApp."
      />
      <NumerosWhatsapp
        instanciasIniciais={instancias}
        abrirOficial={abrir === "1"}
        oficial={{ disponivel, pode: podeUsarOficial(profile), ehAdmin: profile.role === "admin", instancias: oficiais }}
      />
    </div>
  );
}
