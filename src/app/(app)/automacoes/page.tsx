import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarAutomacoesUsuario } from "@/lib/automation-db";
import { listarCampanhas, listarInstancias } from "@/lib/dispatch-db";
import { AutomationsPanel } from "@/components/automations/automations-panel";
import { DispatchAutomationsPanel } from "@/components/automations/dispatch-automations-panel";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const isAdmin = profile?.role === "admin";

  const [automacoes, campanhas, instancias] = await Promise.all([
    listarAutomacoesUsuario(supabase, user.id),
    listarCampanhas(supabase, user.id),
    isAdmin ? listarInstancias(supabase, user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção"
        title="Automações"
        description="Buscas programadas (CNPJ ou Google Maps) com exportação automática para Google Sheets e, opcionalmente, inscrição automática numa campanha de disparo."
      />
      <AutomationsPanel automacoesIniciais={automacoes} campanhas={campanhas} />

      {isAdmin && (
        <DispatchAutomationsPanel
          campanhasIniciais={campanhas.filter((c) => c.tipo_origem === "auto_trigger" || c.tipo_origem === "sheet_watch")}
          instancias={instancias}
        />
      )}
    </div>
  );
}
