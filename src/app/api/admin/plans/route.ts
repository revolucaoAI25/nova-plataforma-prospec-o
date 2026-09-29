import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

async function checarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) return null;
  return user;
}

export async function GET() {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("plans").select("*").order("ordem");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ planos: data });
}

const createSchema = z.object({
  nome: z.string().min(1),
  precoCentavos: z.number().int().min(1),
  creditosMensais: z.number().int().min(0),
  descricao: z.string().optional(),
  ordem: z.number().int().default(0),
});

export async function POST(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plans")
    .insert({
      nome: parsed.data.nome,
      preco_centavos: parsed.data.precoCentavos,
      creditos_mensais: parsed.data.creditosMensais,
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
  creditosMensais: z.number().int().min(0).optional(),
  descricao: z.string().optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
  disparo_habilitado: z.boolean().optional(),
  instagram_visible: z.boolean().optional(),
  linkedin_visible: z.boolean().optional(),
  enriquecimento_ia_habilitado: z.boolean().optional(),
  bigdatacorp_enrichment_habilitado: z.boolean().optional(),
  email_disparo_habilitado: z.boolean().optional(),
  linkedin_disparo_habilitado: z.boolean().optional(),
});

const FLAG_KEYS = [
  "disparo_habilitado",
  "instagram_visible",
  "linkedin_visible",
  "enriquecimento_ia_habilitado",
  "bigdatacorp_enrichment_habilitado",
  "email_disparo_habilitado",
  "linkedin_disparo_habilitado",
] as const;

export async function PATCH(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) campos.nome = parsed.data.nome;
  if (parsed.data.precoCentavos !== undefined) campos.preco_centavos = parsed.data.precoCentavos;
  if (parsed.data.creditosMensais !== undefined) campos.creditos_mensais = parsed.data.creditosMensais;
  if (parsed.data.descricao !== undefined) campos.descricao = parsed.data.descricao || null;
  if (parsed.data.ordem !== undefined) campos.ordem = parsed.data.ordem;
  if (parsed.data.ativo !== undefined) campos.ativo = parsed.data.ativo;
  for (const chave of FLAG_KEYS) {
    if (parsed.data[chave] !== undefined) campos[chave] = parsed.data[chave];
  }

  const admin = createAdminClient();
  const { error } = await admin.from("plans").update(campos).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("plans").delete().eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
