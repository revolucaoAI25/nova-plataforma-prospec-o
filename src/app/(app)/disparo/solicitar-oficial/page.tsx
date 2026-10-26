import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { OficialRequestForm } from "@/components/dispatch/oficial-request-form";
import { PageHeader } from "@/components/layout/page-header";
import { emTesteGratis } from "@/lib/teste-gratis-regras";
import { parceiroDatafyConfigurado } from "@/lib/integrations/datafy-parceiro";

export const metadata = { title: "WhatsApp API oficial" };

/**
 * Com a conta de parceiro da Datafy configurada, a API oficial é conectada
 * pela própria pessoa em Números de WhatsApp. Sem ela, vale o pedido manual.
 */
export default async function WhatsappOficialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  // No teste grátis a página abre em modo de visualização (PortaoTesteGratis).
  if (!profile || (!profile.disparo_habilitado && profile.role !== "admin" && !emTesteGratis(profile))) redirect("/");

  if (await parceiroDatafyConfigurado()) redirect("/disparo/numeros?oficial=1");

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PageHeader
        backHref="/disparo/numeros"
        eyebrow="Disparo WhatsApp"
        title="Solicitar API oficial"
        description="O canal oficial (WhatsApp Business Cloud API) exige aprovação de templates de mensagem e é preparado pela nossa equipe. Preencha os dados abaixo para solicitar."
      />
      <OficialRequestForm />
    </div>
  );
}
