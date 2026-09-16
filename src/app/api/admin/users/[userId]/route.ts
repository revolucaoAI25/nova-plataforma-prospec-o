import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

const patchSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  cdd_credits: z.number().int().min(0).optional(),
  monthly_cdd_credits: z.number().int().min(0).optional(),
  maps_credits: z.number().int().min(0).optional(),
  monthly_maps_credits: z.number().int().min(0).optional(),
  maps_credits_enabled: z.boolean().optional(),
  cdd_api_key_admin: z.string().nullable().optional(),
  maps_keys_pool: z
    .array(z.object({ key: z.string(), limit: z.number(), usage: z.number(), month: z.string() }))
    .optional(),
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
