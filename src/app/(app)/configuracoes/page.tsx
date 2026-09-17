import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MapsSettings } from "@/components/settings/maps-settings";
import { ApifySettings } from "@/components/settings/apify-settings";
import { SheetsSettings } from "@/components/settings/sheets-settings";
import { PageHeader } from "@/components/layout/page-header";

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Conta" title="Configurações" description="Chaves próprias, preferências de cota e integrações." />
      {profile && (
        <Tabs defaultValue="maps">
          <TabsList>
            <TabsTrigger value="maps">Google Maps</TabsTrigger>
            <TabsTrigger value="instagram">Apify</TabsTrigger>
            <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
          </TabsList>
          <TabsContent value="maps">
            <MapsSettings profile={profile} />
          </TabsContent>
          <TabsContent value="instagram">
            <ApifySettings profile={profile} />
          </TabsContent>
          <TabsContent value="sheets">
            <SheetsSettings profile={profile} initialFeedback={sheets} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
