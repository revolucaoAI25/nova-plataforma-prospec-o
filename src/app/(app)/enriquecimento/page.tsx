import { redirect } from "next/navigation";
import { BrainCircuit, Database } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { bigDataCorpConfigurado } from "@/lib/integrations/bigdatacorp";
import { PageHeader } from "@/components/layout/page-header";
import { EnrichmentPanel } from "@/components/enrichment/enrichment-panel";
import { BigDataCorpEnrichmentPanel } from "@/components/bigdatacorp/bigdatacorp-enrichment-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata = { title: "Enriquecimento" };

export default async function EnriquecimentoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const podeIa = Boolean(profile && (profile.enriquecimento_ia_habilitado || profile.role === "admin"));
  const podeBigDataCorp = Boolean(profile && (profile.bigdatacorp_enrichment_habilitado || profile.role === "admin"));
  if (!profile || (!podeIa && !podeBigDataCorp)) redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção"
        title="Enriquecimento"
        description="Transforme leads em dados comerciais mais completos — via IA (nome/e-mail/telefone) ou por CNPJ (sócios e contato)."
      />
      {podeIa && podeBigDataCorp ? (
        <Tabs defaultValue="ia">
          <TabsList>
            <TabsTrigger value="ia"><BrainCircuit className="h-3.5 w-3.5" /> Via IA</TabsTrigger>
            <TabsTrigger value="bigdatacorp"><Database className="h-3.5 w-3.5" /> Sócios e Contato</TabsTrigger>
          </TabsList>
          <TabsContent value="ia">
            <EnrichmentPanel openaiKeyConfigurada={Boolean(profile.openai_api_key)} />
          </TabsContent>
          <TabsContent value="bigdatacorp">
            <BigDataCorpEnrichmentPanel configurado={bigDataCorpConfigurado()} />
          </TabsContent>
        </Tabs>
      ) : podeIa ? (
        <EnrichmentPanel openaiKeyConfigurada={Boolean(profile.openai_api_key)} />
      ) : (
        <BigDataCorpEnrichmentPanel configurado={bigDataCorpConfigurado()} />
      )}
    </div>
  );
}
