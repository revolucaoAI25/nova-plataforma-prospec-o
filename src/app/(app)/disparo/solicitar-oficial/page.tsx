import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { OficialRequestForm } from "@/components/dispatch/oficial-request-form";
import { ConectarOficial, type InstanciaOficialResumo } from "@/components/dispatch/conectar-oficial";
import { PageHeader } from "@/components/layout/page-header";
import { emTesteGratis } from "@/lib/teste-gratis-regras";
import { parceiroDatafyConfigurado } from "@/lib/integrations/datafy-parceiro";
import { podeUsarOficial } from "@/lib/whatsapp-oficial-canal";

export const metadata = { title: "WhatsApp API oficial" };

export default async function WhatsappOficialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  // No teste grátis a página abre em modo de visualização (PortaoTesteGratis).
  if (!profile || (!profile.disparo_habilitado && profile.role !== "admin" && !emTesteGratis(profile))) redirect("/");

  // Sem a conta de parceiro da Datafy configurada, vale o pedido manual de antes.
  if (!(await parceiroDatafyConfigurado())) {
    return (
      <div className="flex max-w-lg flex-col gap-6">
        <PageHeader
          backHref="/disparo"
          eyebrow="Engajamento · Disparo WhatsApp"
          title="Solicitar canal oficial"
          description="O canal oficial (WhatsApp Business Cloud API) exige aprovação de templates de mensagem e é provisionado pela nossa equipe. Preencha os dados abaixo para solicitar."
        />
        <OficialRequestForm />
      </div>
    );
  }

  // Só os canais conectados pela própria pessoa (os provisionados à mão pelo admin seguem em Disparo → Instâncias).
  const sb = createAdminClient();
  const { data: canais } = await sb.from("datafy_canais").select("instance_id").eq("user_id", user.id).is("cancelado_em", null);
  const ids = ((canais ?? []) as { instance_id: string | null }[]).map((c) => c.instance_id).filter((i): i is string => Boolean(i));
  const { data: insts } = ids.length
    ? await sb.from("whatsapp_instances").select("id, status, numero_conectado, nome").in("id", ids)
    : { data: [] };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        backHref="/disparo"
        eyebrow="Engajamento · Disparo WhatsApp"
        title="WhatsApp API oficial"
        description="Conecte o número da sua empresa à API oficial do WhatsApp: sem risco de bloqueio do número, com templates aprovados pela Meta e status de entrega e leitura."
      />
      <ConectarOficial
        pode={podeUsarOficial(profile)}
        instancias={(insts ?? []) as InstanciaOficialResumo[]}
        ehAdmin={profile.role === "admin"}
      />
    </div>
  );
}
