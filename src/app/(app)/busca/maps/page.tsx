import { MapsSearchForm } from "@/components/search/maps-search-form";

export const metadata = { title: "Busca por Google Maps" };

export default function BuscaMapsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Busca por Google Maps</h1>
        <p className="text-muted-foreground">
          Estabelecimentos por nicho e localidade, com telefone, site e avaliação.
        </p>
      </div>
      <MapsSearchForm />
    </div>
  );
}
