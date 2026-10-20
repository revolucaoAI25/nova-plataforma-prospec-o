import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { BigDataCorpResults } from "@/components/bigdatacorp/bigdatacorp-enrichment-results";
import { Badge } from "@/components/ui/badge";
import type { BigDataCorpEnrichmentRunRow } from "@/lib/database.types";
import { listarLeadsRunBigDataCorp } from "@/lib/bigdatacorp-enrichment-db";
import { formatarDataHora } from "@/lib/datas";

export const metadata = { title: "Sócios e Contato" };

const STATUS_LABEL: Record<string, string> = {
  pendente: "Na fila", processando: "Processando", concluido: "Concluído", erro: "Erro",
};

export default async function BigDataCorpRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run } = await supabase.from("bigdatacorp_enrichment_runs").select("*").eq("id", id).single();
  if (!run) notFound();

  // Em páginas: execuções da busca por CNPJ passam de 1000 empresas.
  const leads = await listarLeadsRunBigDataCorp(supabase, id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/historico"
        backLabel="Voltar ao histórico"
        title="Sócios e Contato"
        badge={<Badge variant="outline">{STATUS_LABEL[run.status] ?? run.status}</Badge>}
        description={formatarDataHora(run.created_at)}
      />
      <BigDataCorpResults run={run as BigDataCorpEnrichmentRunRow} leads={leads} />
    </div>
  );
}
