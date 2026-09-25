import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  obterCampanhaEmail,
  listarEtapasEmail,
  statsCampanhaEmail,
  listarSenders,
  listarTargetsCampanhaEmail,
  obterSheetWatcherEmail,
  listarTemplatesEmail,
} from "@/lib/email-dispatch-db";
import { listarPesquisas } from "@/lib/db";
import { CampaignDetail } from "@/components/email-dispatch/campaign-detail";
import { PageHeader } from "@/components/layout/page-header";

export default async function CampanhaEmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campanha = await obterCampanhaEmail(supabase, id);
  if (!campanha) notFound();

  const [etapas, stats, senders, pesquisas, targets, watcher, templates] = await Promise.all([
    listarEtapasEmail(supabase, id),
    statsCampanhaEmail(supabase, id),
    listarSenders(supabase, user.id),
    listarPesquisas(supabase, 100),
    listarTargetsCampanhaEmail(supabase, id),
    obterSheetWatcherEmail(supabase, id),
    listarTemplatesEmail(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader backHref="/disparo-email" backLabel="Voltar às campanhas" title={campanha.nome} />
      <CampaignDetail
        campanha={campanha}
        etapasIniciais={etapas}
        statsIniciais={stats}
        senders={senders}
        pesquisas={pesquisas}
        targetsIniciais={targets}
        watcherInicial={watcher}
        templates={templates}
      />
    </div>
  );
}
