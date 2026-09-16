import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { obterCampanha, listarEtapas, statsCampanha, listarInstancias } from "@/lib/dispatch-db";
import { listarPesquisas } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CampaignDetail } from "@/components/dispatch/campaign-detail";

export default async function CampanhaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campanha = await obterCampanha(supabase, id);
  if (!campanha) notFound();

  const [etapas, stats, instancias, pesquisas] = await Promise.all([
    listarEtapas(supabase, id),
    statsCampanha(supabase, id),
    listarInstancias(supabase, user.id),
    listarPesquisas(supabase, 100),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/disparo">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{campanha.nome}</h1>
      </div>
      <CampaignDetail
        campanha={campanha}
        etapasIniciais={etapas}
        statsIniciais={stats}
        instancias={instancias}
        pesquisas={pesquisas}
      />
    </div>
  );
}
