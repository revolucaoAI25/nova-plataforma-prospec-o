import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  obterCampanha,
  listarEtapas,
  statsCampanha,
  listarInstancias,
  listarTargetsCampanha,
  obterSheetWatcher,
  listarTemplatesDb,
} from "@/lib/dispatch-db";
import { listarPesquisas } from "@/lib/db";
import { CampaignDetail } from "@/components/dispatch/campaign-detail";
import { PageHeader } from "@/components/layout/page-header";

export default async function CampanhaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campanha = await obterCampanha(supabase, id);
  if (!campanha) notFound();

  const [etapas, stats, instancias, pesquisas, targets, watcher, templates] = await Promise.all([
    listarEtapas(supabase, id),
    statsCampanha(supabase, id),
    listarInstancias(supabase, user.id),
    listarPesquisas(supabase, 100),
    listarTargetsCampanha(supabase, id),
    obterSheetWatcher(supabase, id),
    listarTemplatesDb(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader backHref="/disparo" backLabel="Voltar às campanhas" title={campanha.nome} />
      <CampaignDetail
        campanha={campanha}
        etapasIniciais={etapas}
        statsIniciais={stats}
        instancias={instancias}
        pesquisas={pesquisas}
        targetsIniciais={targets}
        watcherInicial={watcher}
        templates={templates}
      />
    </div>
  );
}
