import { redirect } from "next/navigation";
import { Mail as MailIcon, Megaphone, FileText, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarSenders, listarCampanhasEmail, listarTemplatesEmail } from "@/lib/email-dispatch-db";
import { SendersPanel } from "@/components/email-dispatch/senders-panel";
import { CampaignsPanel } from "@/components/email-dispatch/campaigns-panel";
import { TemplatesPanel } from "@/components/email-dispatch/templates-panel";
import { ReportsPanel } from "@/components/email-dispatch/reports-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Disparo E-mail" };

export default async function DisparoEmailPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile || (!profile.email_disparo_habilitado && profile.role !== "admin")) redirect("/");

  const [senders, campanhas, templates] = await Promise.all([
    listarSenders(supabase, user.id),
    listarCampanhasEmail(supabase, user.id),
    listarTemplatesEmail(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Engajamento · Disparo E-mail"
        title="Disparo E-mail"
        description="Remetentes, campanhas de cadência, templates e relatórios — envio via Resend."
      />

      <Tabs defaultValue="remetentes">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="remetentes"><MailIcon className="h-3.5 w-3.5" /> Remetentes</TabsTrigger>
          <TabsTrigger value="campanhas"><Megaphone className="h-3.5 w-3.5" /> Campanhas</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-3.5 w-3.5" /> Templates</TabsTrigger>
          <TabsTrigger value="relatorios"><BarChart3 className="h-3.5 w-3.5" /> Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="remetentes">
          <SendersPanel sendersIniciais={senders} />
        </TabsContent>
        <TabsContent value="campanhas">
          <CampaignsPanel campanhasIniciais={campanhas} senders={senders} />
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
