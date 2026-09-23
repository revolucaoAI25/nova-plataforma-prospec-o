import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarAutomacoesUsuario } from "@/lib/automation-db";
import { listarCampanhas, listarInstancias } from "@/lib/dispatch-db";
import { AutomationsPanel } from "@/components/automations/automations-panel";
import { DispatchAutomationsPanel } from "@/components/automations/dispatch-automations-panel";
import { FlowsListPanel } from "@/components/flows/flows-list-panel";
import { PageHeader } from "@/components/layout/page-header";
import type { AutomationFlowRow } from "@/lib/database.types";

export const metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const isAdmin = profile?.role === "admin";

  const [automacoes, campanhas, instancias, { data: fluxosData }] = await Promise.all([
    listarAutomacoesUsuario(supabase, user.id),
    listarCampanhas(supabase, user.id),
    isAdmin ? listarInstancias(supabase, user.id) : Promise.resolve([]),
    supabase.from("automation_flows").select("*").order("created_at", { ascending: false }),
  ]);
  const fluxos = (fluxosData as AutomationFlowRow[]) || [];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Prospecção"
        title="Automações"
        description="Monte fluxos visuais combinando extração, enriquecimento e disparo, ou use as automações clássicas de busca agendada."
      />

      <FlowsListPanel fluxosIniciais={fluxos} />

      <div className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Automações antigas</h2>
          <p className="text-sm text-muted-foreground">Buscas programadas (CNPJ ou Google Maps) com exportação automática para Google Sheets e, opcionalmente, inscrição automática numa campanha de disparo.</p>
        </div>
        <AutomationsPanel automacoesIniciais={automacoes} campanhas={campanhas} />

        {isAdmin && (
          <DispatchAutomationsPanel
            campanhasIniciais={campanhas.filter((c) => c.tipo_origem === "auto_trigger" || c.tipo_origem === "sheet_watch")}
            instancias={instancias}
          />
        )}
      </div>
    </div>
  );
}
