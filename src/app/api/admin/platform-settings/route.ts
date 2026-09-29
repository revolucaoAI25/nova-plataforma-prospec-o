import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { PLATFORM_SETTINGS_META, invalidarCachePlatformSettings } from "@/lib/platform-settings";
import type { PlatformSettingKey } from "@/lib/database.types";

async function checarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) return null;
  return user;
}

const TODAS_CHAVES = Object.keys(PLATFORM_SETTINGS_META) as PlatformSettingKey[];

/** Nunca devolve o valor bruto de uma chave secreta pro cliente — só se está preenchida (DB ou env var) e por onde veio. */
export async function GET() {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin.from("platform_settings").select("chave, valor, atualizado_em");
  const porChave = new Map((data ?? []).map((r) => [r.chave as PlatformSettingKey, r]));

  const itens = TODAS_CHAVES.map((chave) => {
    const meta = PLATFORM_SETTINGS_META[chave];
    const linha = porChave.get(chave);
    const valorDb = linha?.valor ?? null;
    const envPreenchida = Boolean(process.env[meta.envFallback]);
    return {
      chave,
      grupo: meta.grupo,
      label: meta.label,
      secreto: meta.secreto,
      envFallback: meta.envFallback,
      preenchidaNoAdmin: Boolean(valorDb && valorDb.trim()),
      preenchidaViaEnv: envPreenchida,
      // Só devolve o valor em texto puro pra chaves NÃO secretas (URLs/IDs) — o resto fica mascarado.
      valor: !meta.secreto ? valorDb : null,
      atualizadoEm: linha?.atualizado_em ?? null,
    };
  });

  return NextResponse.json({ itens });
}

const patchSchema = z.object({
  chave: z.enum(TODAS_CHAVES as [PlatformSettingKey, ...PlatformSettingKey[]]),
  valor: z.string(),
});

/** valor "" remove a linha (volta a cair no fallback de env var). */
export async function PATCH(request: Request) {
  const user = await checarAdmin();
  if (!user) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const valor = parsed.data.valor.trim();

  if (!valor) {
    const { error } = await admin.from("platform_settings").delete().eq("chave", parsed.data.chave);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("platform_settings")
      .upsert({ chave: parsed.data.chave, valor, atualizado_em: new Date().toISOString(), atualizado_por: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidarCachePlatformSettings();
  return NextResponse.json({ ok: true });
}
