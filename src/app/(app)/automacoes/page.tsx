import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listarAutomacoesUsuario } from "@/lib/automation-db";
import { listarCampanhas } from "@/lib/dispatch-db";
import { AutomationsPanel } from "@/components/automations/automations-panel";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [automacoes, campanhas] = await Promise.all([
    listarAutomacoesUsuario(supabase, user.id),
    listarCampanhas(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção"
        title="Automações"
        description="Buscas programadas (CNPJ ou Google Maps) com exportação automática para Google Sheets e, opcionalmente, inscrição automática numa campanha de disparo."
      />
      <AutomationsPanel automacoesIniciais={automacoes} campanhas={campanhas} />
    </div>
  );
}
