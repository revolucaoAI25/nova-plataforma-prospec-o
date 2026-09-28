import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  obterCampanhaLinkedin,
  listarEtapasLinkedin,
  statsCampanhaLinkedin,
  listarContas,
  listarTargetsCampanhaLinkedin,
  obterSheetWatcherLinkedin,
  listarTemplatesLinkedin,
} from "@/lib/linkedin-dispatch-db";
import { listarPesquisas } from "@/lib/db";
import { CampaignDetail } from "@/components/linkedin-dispatch/campaign-detail";
import { PageHeader } from "@/components/layout/page-header";

export default async function CampanhaLinkedinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campanha = await obterCampanhaLinkedin(supabase, id);
  if (!campanha) notFound();

  const [etapas, stats, contas, pesquisas, targets, watcher, templates] = await Promise.all([
    listarEtapasLinkedin(supabase, id),
    statsCampanhaLinkedin(supabase, id),
    listarContas(supabase, user.id),
    listarPesquisas(supabase, 100),
    listarTargetsCampanhaLinkedin(supabase, id),
    obterSheetWatcherLinkedin(supabase, id),
    listarTemplatesLinkedin(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader backHref="/disparo-linkedin" backLabel="Voltar às campanhas" title={campanha.nome} />
      <CampaignDetail
        campanha={campanha}
        etapasIniciais={etapas}
        statsIniciais={stats}
        contas={contas}
        pesquisas={pesquisas}
        targetsIniciais={targets}
        watcherInicial={watcher}
        templates={templates}
      />
    </div>
  );
}
