import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { PageHeader } from "@/components/layout/page-header";
import { EnrichmentPanel } from "@/components/enrichment/enrichment-panel";

export const metadata = { title: "Enriquecimento com IA" };

export default async function EnriquecimentoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile || !(profile.enriquecimento_ia_habilitado || profile.role === "admin")) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção"
        title="Enriquecimento com IA"
        description="Transforme nome, e-mail ou telefone em dados comerciais — empresa, cargo, LinkedIn e mais."
      />
      <EnrichmentPanel openaiKeyConfigurada={Boolean(profile.openai_api_key)} />
    </div>
  );
}
