import { redirect } from "next/navigation";
import Link from "next/link";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { PLATFORM_SETTINGS_META } from "@/lib/platform-settings";
import type { AddonRow, CreditCostRow, CreditPackageRow, PlanRow, PlatformSettingKey, UserStatsRow } from "@/lib/database.types";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { CreditCostsPanel } from "@/components/admin/credit-costs-panel";
import { CreditPackagesPanel } from "@/components/admin/credit-packages-panel";
import { PlansPanel } from "@/components/admin/plans-panel";
import { AddonsPanel } from "@/components/admin/addons-panel";
import { PlatformSettingsPanel } from "@/components/admin/platform-settings-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Administração" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/");

  const { data } = await supabase.from("user_stats").select("*").order("created_at", { ascending: false });
  const users = (data as UserStatsRow[]) ?? [];
  const { data: custosData } = await supabase.from("credit_costs").select("*").order("acao");
  const custos = (custosData as CreditCostRow[]) ?? [];
  const { data: pacotesData } = await supabase.from("credit_packages").select("*").order("ordem");
  const pacotes = (pacotesData as CreditPackageRow[]) ?? [];
  const { data: planosData } = await supabase.from("plans").select("*").order("ordem");
  const planos = (planosData as PlanRow[]) ?? [];
  const { data: addonsData } = await supabase.from("addons").select("*").order("ordem");
  const addons = (addonsData as AddonRow[]) ?? [];

  const admin = createAdminClient();
  const { data: settingsData } = await admin.from("platform_settings").select("chave, valor, atualizado_em");
  const settingsPorChave = new Map((settingsData ?? []).map((r) => [r.chave as PlatformSettingKey, r]));
  const platformSettings = (Object.keys(PLATFORM_SETTINGS_META) as PlatformSettingKey[]).map((chave) => {
    const meta = PLATFORM_SETTINGS_META[chave];
    const linha = settingsPorChave.get(chave);
    const valorDb = linha?.valor ?? null;
    return {
      chave,
      grupo: meta.grupo,
      label: meta.label,
      secreto: meta.secreto,
      envFallback: meta.envFallback,
      preenchidaNoAdmin: Boolean(valorDb && valorDb.trim()),
      preenchidaViaEnv: Boolean(process.env[meta.envFallback]),
      valor: !meta.secreto ? valorDb : null,
      atualizadoEm: linha?.atualizado_em ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description="Usuários, créditos e chaves administradas."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/disparo">
              <Send className="h-4 w-4" /> Canal oficial — disparo
            </Link>
          </Button>
        }
      />
      <CreateUserForm />
      <PlatformSettingsPanel itensIniciais={platformSettings} />
      <CreditCostsPanel custos={custos} />
      <PlansPanel planosIniciais={planos} />
      <AddonsPanel addonsIniciais={addons} />
      <CreditPackagesPanel pacotesIniciais={pacotes} />
      <AdminUsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
