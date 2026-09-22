import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EnrichmentResults } from "@/components/enrichment/enrichment-results";
import { Badge } from "@/components/ui/badge";
import type { EnrichmentRunRow, EnrichmentLeadRow } from "@/lib/database.types";

export const metadata = { title: "Enriquecimento com IA" };

const STATUS_LABEL: Record<string, string> = {
  pendente: "Na fila", processando: "Processando", concluido: "Concluído", erro: "Erro",
};

export default async function EnrichmentRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run } = await supabase.from("enrichment_runs").select("*").eq("id", id).single();
  if (!run) notFound();

  const { data: leads } = await supabase
    .from("enrichment_leads")
    .select("*")
    .eq("run_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/historico"
        backLabel="Voltar ao histórico"
        title="Enriquecimento com IA"
        badge={<Badge variant="outline">{STATUS_LABEL[run.status] ?? run.status}</Badge>}
        description={new Date(run.created_at).toLocaleString("pt-BR")}
      />
      <EnrichmentResults run={run as EnrichmentRunRow} leads={(leads as EnrichmentLeadRow[]) ?? []} />
    </div>
  );
}
