import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { OficialRequestForm } from "@/components/dispatch/oficial-request-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Solicitar canal oficial" };

export default async function SolicitarOficialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile || (!profile.disparo_habilitado && profile.role !== "admin")) redirect("/");

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PageHeader
        backHref="/disparo"
        eyebrow="Engajamento · Disparo WhatsApp"
        title="Solicitar canal oficial"
        description="O canal oficial (WhatsApp Business Cloud API) exige aprovação de templates de mensagem e é provisionado manualmente pelo administrador. Preencha os dados abaixo para solicitar."
      />
      <OficialRequestForm />
    </div>
  );
}
