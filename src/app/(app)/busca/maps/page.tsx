import { createClient } from "@/lib/supabase/server";
import { custosVisiveis } from "@/lib/credits";
import { MapsSearchForm } from "@/components/search/maps-search-form";
import { PageHeader } from "@/components/layout/page-header";
import { sugestoesDaBusca } from "@/lib/onboarding/publicos";

export const metadata = { title: "Busca por Google Maps" };

export default async function BuscaMapsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [custos, sugestoes] = await Promise.all([custosVisiveis(supabase, ["maps"]), sugestoesDaBusca(user?.id, "maps")]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por Google Maps"
        description="Estabelecimentos por nicho e localidade, com telefone, site e avaliação."
      />
      <MapsSearchForm custoPorResultado={custos.maps} publicos={sugestoes.publicos} temPerfil={sugestoes.temPerfil} precisaAtualizar={sugestoes.precisaAtualizar} />
    </div>
  );
}
