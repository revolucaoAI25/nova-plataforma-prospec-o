import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

const poolEntrySchema = z.object({
  key: z.string(),
  nickname: z.string().optional(),
  limit: z.number(),
  usage: z.number(),
  text_search_usage: z.number().optional(),
  month: z.string(),
});

const patchSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  cdd_credits: z.number().int().min(0).optional(),
  monthly_cdd_credits: z.number().int().min(0).optional(),
  maps_credits: z.number().int().min(0).optional(),
  monthly_maps_credits: z.number().int().min(0).optional(),
  maps_credits_enabled: z.boolean().optional(),
  cdd_api_key_admin: z.string().nullable().optional(),
  maps_api_key_admin: z.string().nullable().optional(),
  maps_keys_pool: z.array(poolEntrySchema).optional(),
  apify_api_key_admin: z.string().nullable().optional(),
  apify_keys_pool: z.array(poolEntrySchema).optional(),
  instagram_credits: z.number().int().min(0).optional(),
  monthly_instagram_credits: z.number().int().min(0).optional(),
  instagram_credits_enabled: z.boolean().optional(),
  instagram_visible: z.boolean().optional(),
  linkedin_credits: z.number().int().min(0).optional(),
  monthly_linkedin_credits: z.number().int().min(0).optional(),
  linkedin_credits_enabled: z.boolean().optional(),
  linkedin_visible: z.boolean().optional(),
  disparo_habilitado: z.boolean().optional(),
  email_disparo_habilitado: z.boolean().optional(),
  enriquecimento_ia_habilitado: z.boolean().optional(),
  conta_teste: z.boolean().optional(),
  teste_expira_em: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(parsed.data).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
