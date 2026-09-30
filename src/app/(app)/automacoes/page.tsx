import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlowsListPanel } from "@/components/flows/flows-list-panel";
import { PageHeader } from "@/components/layout/page-header";
import type { AutomationFlowRow } from "@/lib/database.types";

export const metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("automation_flows").select("*").order("created_at", { ascending: false });
  const fluxos = (data as AutomationFlowRow[]) || [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Prospecção"
        title="Automações"
        description="Fluxos que combinam extração, enriquecimento, disparo e destino — rodando sozinhos no agendamento ou quando você der play."
      />
      <FlowsListPanel fluxosIniciais={fluxos} />
    </div>
  );
}
