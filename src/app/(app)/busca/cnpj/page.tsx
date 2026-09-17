import { CnpjSearchForm } from "@/components/search/cnpj-search-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Busca por CNPJ" };

export default function BuscaCnpjPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por CNPJ"
        description="Empresas ativas na Receita Federal, via Casa dos Dados. Créditos são debitados pelo que for encontrado, não pelo que for pedido."
      />
      <CnpjSearchForm />
    </div>
  );
}
