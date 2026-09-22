import { MapPin, Sparkles, Sheet as SheetIcon, BrainCircuit } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MapsSettings } from "@/components/settings/maps-settings";
import { ApifySettings } from "@/components/settings/apify-settings";
import { SheetsSettings } from "@/components/settings/sheets-settings";
import { OpenAiSettings } from "@/components/settings/openai-settings";
import { PageHeader } from "@/components/layout/page-header";
import { oauthDisponivel } from "@/lib/integrations/google-sheets";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ sheets?: string }>;
}) {
  const { sheets } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id) : null;
  const podeUsarIa = Boolean(profile && (profile.enriquecimento_ia_habilitado || profile.role === "admin"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Conta" title="Configurações" description="Chaves próprias, preferências de cota e integrações." />
      {profile && (
        <Tabs defaultValue="maps">
          <TabsList>
            <TabsTrigger value="maps"><MapPin className="h-3.5 w-3.5" /> Google Maps</TabsTrigger>
            <TabsTrigger value="instagram"><Sparkles className="h-3.5 w-3.5" /> Apify</TabsTrigger>
            <TabsTrigger value="sheets"><SheetIcon className="h-3.5 w-3.5" /> Google Sheets</TabsTrigger>
            {podeUsarIa && <TabsTrigger value="openai"><BrainCircuit className="h-3.5 w-3.5" /> OpenAI</TabsTrigger>}
          </TabsList>
          <TabsContent value="maps">
            <MapsSettings profile={profile} />
          </TabsContent>
          <TabsContent value="instagram">
            <ApifySettings profile={profile} />
          </TabsContent>
          <TabsContent value="sheets">
            <SheetsSettings profile={profile} initialFeedback={sheets} oauthConfigured={oauthDisponivel()} />
          </TabsContent>
          {podeUsarIa && (
            <TabsContent value="openai">
              <OpenAiSettings profile={profile} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
