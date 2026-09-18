import { redirect } from "next/navigation";
import Link from "next/link";
import { Smartphone, Megaphone, FileText, BarChart3, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarInstancias, listarCampanhas, listarTemplatesDb } from "@/lib/dispatch-db";
import { InstancesPanel } from "@/components/dispatch/instances-panel";
import { CampaignsPanel } from "@/components/dispatch/campaigns-panel";
import { TemplatesPanel } from "@/components/dispatch/templates-panel";
import { ReportsPanel } from "@/components/dispatch/reports-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";

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
        title="Disparo WhatsApp"
        description="Instâncias conectadas, campanhas de cadência, templates do canal oficial e relatórios."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/disparo/solicitar-oficial">
              <Send className="h-4 w-4" /> Solicitar canal oficial
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="instancias">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="instancias"><Smartphone className="h-3.5 w-3.5" /> Instâncias</TabsTrigger>
          <TabsTrigger value="campanhas"><Megaphone className="h-3.5 w-3.5" /> Campanhas</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-3.5 w-3.5" /> Templates</TabsTrigger>
          <TabsTrigger value="relatorios"><BarChart3 className="h-3.5 w-3.5" /> Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="instancias">
          <InstancesPanel instanciasIniciais={instancias} />
        </TabsContent>
        <TabsContent value="campanhas">
          <CampaignsPanel campanhasIniciais={campanhas} instancias={instancias} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesPanel templatesIniciais={templates} instanciasOficiais={instancias.filter((i) => i.canal === "oficial")} />
        </TabsContent>
        <TabsContent value="relatorios">
          <ReportsPanel campanhasIniciais={campanhas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
