import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { obterFunil, funilPertenceAoUsuario, listarColunas, listarCards } from "@/lib/funil-db";
import { PageHeader } from "@/components/layout/page-header";
import { FunilBoard } from "@/components/funil/funil-board";
import type { AutomationFlowRow } from "@/lib/database.types";

export default async function FunilDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const profile = await getProfile(supabase, user.id);
  if (!profile || !(await funilPertenceAoUsuario(supabase, id, profile))) notFound();

  const [funil, colunas, cards, flowsResp] = await Promise.all([
    obterFunil(supabase, id),
    listarColunas(supabase, id),
    listarCards(supabase, id),
    supabase.from("automation_flows").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  if (!funil) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader backHref="/funil" backLabel="Voltar aos funis" eyebrow="Prospecção" title={funil.nome} />
      <FunilBoard
        funilId={id}
        colunasIniciais={colunas}
        cardsIniciais={cards}
        flows={(flowsResp.data as Pick<AutomationFlowRow, "id" | "nome">[]) || []}
      />
    </div>
  );
}
