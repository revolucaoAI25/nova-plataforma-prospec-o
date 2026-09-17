import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarInstancias, listarCampanhas, listarTemplatesDb } from "@/lib/dispatch-db";
import { InstancesPanel } from "@/components/dispatch/instances-panel";
import { CampaignsPanel } from "@/components/dispatch/campaigns-panel";
import { TemplatesPanel } from "@/components/dispatch/templates-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Send } from "lucide-react";

export const metadata = { title: "Disparo WhatsApp" };

export default async function DisparoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile || (!profile.disparo_habilitado && profile.role !== "admin")) redirect("/");

  const [instancias, campanhas, templates] = await Promise.all([
    listarInstancias(supabase, user.id),
    listarCampanhas(supabase, user.id),
    listarTemplatesDb(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Engajamento · Disparo WhatsApp"
        title="Campanhas"
        description="Instâncias conectadas e campanhas de cadência."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/disparo/solicitar-oficial">
              <Send className="h-4 w-4" /> Solicitar canal oficial
            </Link>
          </Button>
        }
      />

      <InstancesPanel instanciasIniciais={instancias} />
      <TemplatesPanel templatesIniciais={templates} instanciasOficiais={instancias.filter((i) => i.canal === "oficial")} />
      <CampaignsPanel campanhasIniciais={campanhas} instancias={instancias} />
    </div>
  );
}
