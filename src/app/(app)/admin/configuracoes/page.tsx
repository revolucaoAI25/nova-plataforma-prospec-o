import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_SETTINGS_META } from "@/lib/platform-settings";
import type { PlatformSettingKey } from "@/lib/database.types";
import { PlatformSettingsPanel } from "@/components/admin/platform-settings-panel";
import { paginaSoAdmin } from "@/lib/admin-pagina";

export const metadata = { title: "Chaves e integrações" };

export default async function AdminConfiguracoesPage() {
  await paginaSoAdmin();
  const { data } = await createAdminClient().from("platform_settings").select("chave, valor, atualizado_em");
  const porChave = new Map((data ?? []).map((r) => [r.chave as PlatformSettingKey, r]));
  // Segredos nunca vão para o navegador: só se estão preenchidos.
  const itens = (Object.keys(PLATFORM_SETTINGS_META) as PlatformSettingKey[]).map((chave) => {
    const meta = PLATFORM_SETTINGS_META[chave];
    const linha = porChave.get(chave);
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

  return <PlatformSettingsPanel itensIniciais={itens} />;
}
