import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { PLAN_FEATURE_FLAG_KEYS } from "@/lib/database.types";

async function checarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) return null;
  return user;
}

const FLAG_ENUM = PLAN_FEATURE_FLAG_KEYS as [string, ...string[]];

export async function GET() {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("addons").select("*").order("ordem");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ addons: data });
}

const createSchema = z.object({
  nome: z.string().min(1),
  precoCentavos: z.number().int().min(1),
  featureFlag: z.enum(FLAG_ENUM),
  descricao: z.string().optional(),
  ordem: z.number().int().default(0),
});

export async function POST(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("addons")
    .insert({
      nome: parsed.data.nome,
      preco_centavos: parsed.data.precoCentavos,
      feature_flag: parsed.data.featureFlag,
      descricao: parsed.data.descricao || null,
      ordem: parsed.data.ordem,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).optional(),
  precoCentavos: z.number().int().min(1).optional(),
  featureFlag: z.enum(FLAG_ENUM).optional(),
  descricao: z.string().optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) campos.nome = parsed.data.nome;
  if (parsed.data.precoCentavos !== undefined) campos.preco_centavos = parsed.data.precoCentavos;
  if (parsed.data.featureFlag !== undefined) campos.feature_flag = parsed.data.featureFlag;
  if (parsed.data.descricao !== undefined) campos.descricao = parsed.data.descricao || null;
  if (parsed.data.ordem !== undefined) campos.ordem = parsed.data.ordem;
  if (parsed.data.ativo !== undefined) campos.ativo = parsed.data.ativo;

  const admin = createAdminClient();
  const { error } = await admin.from("addons").update(campos).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const admin = createAdminClient();

  // `user_addon_subscriptions.addon_id` é ON DELETE CASCADE — remover o
  // add-on com assinantes ativos apaga a linha deles inteira, sem
  // cancelar a cobrança no Asaas: o cliente continua sendo cobrado e nem
  // aparece mais em lugar nenhum do nosso banco pra cancelar. Bloqueia em
  // vez disso — o admin já tem o toggle "Ativo" pra tirar da vitrine sem
  // afetar quem já assina.
  const { count } = await admin
    .from("user_addon_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("addon_id", parsed.data.id)
    .in("status", ["ativa", "pendente", "inadimplente"]);
  if (count && count > 0) {
    return NextResponse.json(
      { error: `Esse add-on tem ${count} assinante(s) ativo(s). Desative-o (toggle "Ativo") em vez de remover, ou cancele as assinaturas antes.` },
      { status: 409 },
    );
  }

  const { error } = await admin.from("addons").delete().eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
