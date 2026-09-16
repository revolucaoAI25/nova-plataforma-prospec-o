import { CnpjSearchForm } from "@/components/search/cnpj-search-form";

export const metadata = { title: "Busca por CNPJ" };

export default function BuscaCnpjPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Busca por CNPJ</h1>
        <p className="text-muted-foreground">
          Empresas ativas na Receita Federal, via Casa dos Dados. Créditos são debitados pelo
          que for encontrado, não pelo que for pedido.
        </p>
      </div>
      <CnpjSearchForm />
    </div>
  );
}
