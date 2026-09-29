import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  }

  const { data, error } = await supabase.from("credit_costs").select("*").order("acao");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ custos: data });
}

const patchSchema = z.object({
  acao: z.string().min(1),
  custo: z.number().int().min(1),
});

/** Admin ajusta o peso de uma ação em créditos — sem isso, mudar o preço de um fornecedor exigiria deploy. */
export async function PATCH(request: Request) {
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
  const { error } = await admin
    .from("credit_costs")
    .update({ custo: parsed.data.custo, updated_at: new Date().toISOString() })
    .eq("acao", parsed.data.acao);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
