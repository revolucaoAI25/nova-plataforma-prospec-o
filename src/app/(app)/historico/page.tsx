import { createClient } from "@/lib/supabase/server";
import { listarPesquisas } from "@/lib/db";
import { HistoricoTable } from "@/components/historico/historico-table";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Histórico" };

export default async function HistoricoPage() {
  const supabase = await createClient();
  const pesquisas = await listarPesquisas(supabase, 300);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Conta" title="Histórico" description="Todas as pesquisas realizadas, com exportação e exclusão." />
      <HistoricoTable pesquisas={pesquisas} />
    </div>
  );
}
