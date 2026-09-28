import { redirect } from "next/navigation";
import { UserSearch, Megaphone, FileText, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarContas, listarCampanhasLinkedin, listarTemplatesLinkedin } from "@/lib/linkedin-dispatch-db";
import { AccountsPanel } from "@/components/linkedin-dispatch/accounts-panel";
import { CampaignsPanel } from "@/components/linkedin-dispatch/campaigns-panel";
import { TemplatesPanel } from "@/components/linkedin-dispatch/templates-panel";
import { ReportsPanel } from "@/components/linkedin-dispatch/reports-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Disparo LinkedIn" };

export default async function DisparoLinkedinPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile || (!profile.linkedin_disparo_habilitado && profile.role !== "admin")) redirect("/");

  const [contas, campanhas, templates] = await Promise.all([
    listarContas(supabase, user.id),
    listarCampanhasLinkedin(supabase, user.id),
    listarTemplatesLinkedin(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Engajamento · Disparo LinkedIn"
        title="Disparo LinkedIn"
        description="Contas conectadas, campanhas de pedido de conexão e mensagem, templates e relatórios."
      />

      <Tabs defaultValue="contas">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="contas"><UserSearch className="h-3.5 w-3.5" /> Contas</TabsTrigger>
          <TabsTrigger value="campanhas"><Megaphone className="h-3.5 w-3.5" /> Campanhas</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-3.5 w-3.5" /> Templates</TabsTrigger>
          <TabsTrigger value="relatorios"><BarChart3 className="h-3.5 w-3.5" /> Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="contas">
          <AccountsPanel contasIniciais={contas} />
        </TabsContent>
        <TabsContent value="campanhas">
          <CampaignsPanel campanhasIniciais={campanhas} contas={contas} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesPanel templatesIniciais={templates} />
        </TabsContent>
        <TabsContent value="relatorios">
          <ReportsPanel campanhasIniciais={campanhas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
