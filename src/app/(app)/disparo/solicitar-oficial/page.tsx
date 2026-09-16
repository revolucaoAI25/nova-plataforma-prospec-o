import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { OficialRequestForm } from "@/components/dispatch/oficial-request-form";

export const metadata = { title: "Solicitar canal oficial" };

export default async function SolicitarOficialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile || (!profile.disparo_habilitado && profile.role !== "admin")) redirect("/");

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Solicitar canal oficial</h1>
        <p className="text-muted-foreground">
          O canal oficial (WhatsApp Business Cloud API) exige aprovação de templates de mensagem e é
          provisionado manualmente pelo administrador. Preencha os dados abaixo para solicitar.
        </p>
      </div>
      <OficialRequestForm />
    </div>
  );
}
