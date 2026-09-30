import { createClient } from "@/lib/supabase/server";
import { custosVisiveis } from "@/lib/credits";
import { MapsSearchForm } from "@/components/search/maps-search-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Busca por Google Maps" };

export default async function BuscaMapsPage() {
  const supabase = await createClient();
  const custos = await custosVisiveis(supabase, ["maps"]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por Google Maps"
        description="Estabelecimentos por nicho e localidade, com telefone, site e avaliação."
      />
      <MapsSearchForm custoPorResultado={custos.maps} />
    </div>
  );
}
