import { Search, BrainCircuit } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarPesquisas, listarExecucoesEnriquecimento } from "@/lib/db";
import { getProfile } from "@/lib/credits";
import { HistoricoTable } from "@/components/historico/historico-table";
import { EnrichmentRunsTable } from "@/components/historico/enrichment-runs-table";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata = { title: "Histórico" };

export default async function HistoricoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id) : null;
  const podeUsarIa = Boolean(profile && (profile.enriquecimento_ia_habilitado || profile.role === "admin"));

  const pesquisas = await listarPesquisas(supabase, 300);
  const execucoesIa = podeUsarIa ? await listarExecucoesEnriquecimento(supabase) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Conta" title="Histórico" description="Todas as pesquisas e enriquecimentos realizados, com exportação e exclusão." />
      {podeUsarIa ? (
        <Tabs defaultValue="buscas">
          <TabsList>
            <TabsTrigger value="buscas"><Search className="h-3.5 w-3.5" /> Buscas</TabsTrigger>
            <TabsTrigger value="ia"><BrainCircuit className="h-3.5 w-3.5" /> Enriquecimento com IA</TabsTrigger>
          </TabsList>
          <TabsContent value="buscas">
            <HistoricoTable pesquisas={pesquisas} />
          </TabsContent>
          <TabsContent value="ia">
            <EnrichmentRunsTable runs={execucoesIa} />
          </TabsContent>
        </Tabs>
      ) : (
        <HistoricoTable pesquisas={pesquisas} />
      )}
    </div>
  );
}
