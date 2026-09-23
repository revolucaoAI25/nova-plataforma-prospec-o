import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlowBuilder } from "@/components/flows/flow-builder";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Novo fluxo" };

export default async function NovoFluxoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Automações" title="Novo fluxo" description="Arraste módulos da paleta pro canvas e conecte-os na ordem que fizer sentido." />
      <FlowBuilder flowInicial={null} />
    </div>
  );
}
