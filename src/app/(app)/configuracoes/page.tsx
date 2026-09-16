import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MapsSettings } from "@/components/settings/maps-settings";
import { ApifySettings } from "@/components/settings/apify-settings";
import { SheetsSettings } from "@/components/settings/sheets-settings";

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
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground">Chaves próprias, preferências de cota e integrações.</p>
      </div>
      {profile && (
        <Tabs defaultValue="maps">
          <TabsList>
            <TabsTrigger value="maps">Google Maps</TabsTrigger>
            <TabsTrigger value="instagram">Instagram</TabsTrigger>
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
