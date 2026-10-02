import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, custosVisiveis } from "@/lib/credits";
import { LinkedInSearchForm } from "@/components/search/linkedin-search-form";
import { PageHeader } from "@/components/layout/page-header";
import { sugestoesDaBusca } from "@/lib/onboarding/publicos";
import { emTesteGratis } from "@/lib/teste-gratis-regras";

export const metadata = { title: "Busca por LinkedIn" };

export default async function BuscaLinkedInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  // No teste grátis a página abre em modo de visualização (PortaoTesteGratis).
  if (!profile?.linkedin_visible && !emTesteGratis(profile)) redirect("/");
  const custos = await custosVisiveis(supabase, ["linkedin"]);

  const sugestoes = await sugestoesDaBusca(user.id, "linkedin");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por LinkedIn"
        description="Encontra pessoas e decisores por cargo e localização."
      />
      <LinkedInSearchForm custoPorResultado={custos.linkedin} publicos={sugestoes.publicos} temPerfil={sugestoes.temPerfil} precisaAtualizar={sugestoes.precisaAtualizar} />
    </div>
  );
}
