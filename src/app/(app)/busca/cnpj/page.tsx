import { createClient } from "@/lib/supabase/server";
import { getProfile, custosVisiveis } from "@/lib/credits";
import { bigDataCorpConfigurado } from "@/lib/integrations/bigdatacorp";
import { CnpjSearchForm } from "@/components/search/cnpj-search-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Busca por CNPJ" };

export default async function BuscaCnpjPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id) : null;
  const bigdatacorpDisponivel = Boolean(
    (await bigDataCorpConfigurado()) && profile && (profile.bigdatacorp_enrichment_habilitado || profile.role === "admin"),
  );
  const custos = await custosVisiveis(supabase, ["cnpj", "cnpj_maps_extra", "bigdatacorp"]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção · Busca"
        title="Busca por CNPJ"
        description="Empresas ativas na Receita Federal. Créditos são debitados pelo que for encontrado, não pelo que for pedido."
      />
      <CnpjSearchForm bigdatacorpDisponivel={bigdatacorpDisponivel} custos={custos} />
    </div>
  );
}
