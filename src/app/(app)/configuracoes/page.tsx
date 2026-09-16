import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground">Sua chave própria do Google Maps e preferências de cota.</p>
      </div>
      {profile && <SettingsForm profile={profile} />}
    </div>
  );
}
