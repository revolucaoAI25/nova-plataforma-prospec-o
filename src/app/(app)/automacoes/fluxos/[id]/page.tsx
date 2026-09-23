import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlowBuilder } from "@/components/flows/flow-builder";
import { PageHeader } from "@/components/layout/page-header";
import type { AutomationFlowRow } from "@/lib/database.types";

export const metadata = { title: "Editar fluxo" };

export default async function EditarFluxoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("automation_flows").select("*").eq("id", id).single();
  const flow = data as AutomationFlowRow | null;
  if (!flow) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Automações" title={flow.nome} description="Edite o fluxo, salve e acompanhe as execuções no histórico abaixo." />
      <FlowBuilder flowInicial={flow} />
    </div>
  );
}
