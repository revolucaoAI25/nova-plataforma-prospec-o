import { MapsSearchForm } from "@/components/search/maps-search-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Busca por Google Maps" };

export default function BuscaMapsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por Google Maps"
        description="Estabelecimentos por nicho e localidade, com telefone, site e avaliação."
      />
      <MapsSearchForm />
    </div>
  );
}
