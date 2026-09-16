import { createClient } from "@/lib/supabase/server";
import { listarPesquisas } from "@/lib/db";
import { HistoricoTable } from "@/components/historico/historico-table";

export const metadata = { title: "Histórico" };

export default async function HistoricoPage() {
  const supabase = await createClient();
  const pesquisas = await listarPesquisas(supabase, 300);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <p className="text-muted-foreground">Todas as pesquisas realizadas, com exportação e exclusão.</p>
      </div>
      <HistoricoTable pesquisas={pesquisas} />
    </div>
  );
}
