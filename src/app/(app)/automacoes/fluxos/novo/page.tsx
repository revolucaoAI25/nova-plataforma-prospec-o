import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlowBuilder } from "@/components/flows/flow-builder";
import { PageHeader } from "@/components/layout/page-header";
import { FLOW_TEMPLATES } from "@/lib/flow/templates";

export const metadata = { title: "Novo fluxo" };

export default async function NovoFluxoPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { template: templateId } = await searchParams;
  const templateInicial = templateId ? FLOW_TEMPLATES.find((t) => t.id === templateId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Automações"
        title={templateInicial ? templateInicial.nome : "Novo fluxo"}
        description={
          templateInicial
            ? "Fluxo pré-montado a partir de um template — complete os campos marcados com alerta (planilha, campanha, CNAEs…) e salve."
            : "Arraste módulos da paleta pro canvas e conecte-os na ordem que fizer sentido."
        }
      />
      <FlowBuilder flowInicial={null} templateInicial={templateInicial} />
    </div>
  );
}
