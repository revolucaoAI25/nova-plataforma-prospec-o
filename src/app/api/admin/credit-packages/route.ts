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
  const { data, error } = await admin.from("credit_packages").select("*").order("ordem");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pacotes: data });
}

const createSchema = z.object({
  nome: z.string().min(1),
  quantidadeCreditos: z.number().int().min(1),
  precoCentavos: z.number().int().min(1),
  ordem: z.number().int().default(0),
});

export async function POST(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credit_packages")
    .insert({
      nome: parsed.data.nome,
      quantidade_creditos: parsed.data.quantidadeCreditos,
      preco_centavos: parsed.data.precoCentavos,
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
  quantidadeCreditos: z.number().int().min(1).optional(),
  precoCentavos: z.number().int().min(1).optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) campos.nome = parsed.data.nome;
  if (parsed.data.quantidadeCreditos !== undefined) campos.quantidade_creditos = parsed.data.quantidadeCreditos;
  if (parsed.data.precoCentavos !== undefined) campos.preco_centavos = parsed.data.precoCentavos;
  if (parsed.data.ordem !== undefined) campos.ordem = parsed.data.ordem;
  if (parsed.data.ativo !== undefined) campos.ativo = parsed.data.ativo;

  const admin = createAdminClient();
  const { error } = await admin.from("credit_packages").update(campos).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request) {
  if (!(await checarAdmin())) return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("credit_packages").delete().eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
