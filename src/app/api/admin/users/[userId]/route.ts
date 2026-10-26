import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { camposAtivacaoContaTeste } from "@/lib/conta-teste";
import { dadosClienteSchema, erroValidacao } from "@/lib/dados-cliente";
import { capturarCondicaoAtual, esquecerCondicao } from "@/lib/condicao-preco";

const patchSchema = dadosClienteSchema.extend({
  role: z.enum(["user", "admin"]).optional(),
  creditos: z.number().int().min(0).optional(),
  monthly_creditos: z.number().int().min(0).optional(),
  instagram_visible: z.boolean().optional(),
  linkedin_visible: z.boolean().optional(),
  disparo_habilitado: z.boolean().optional(),
  email_disparo_habilitado: z.boolean().optional(),
  linkedin_disparo_habilitado: z.boolean().optional(),
  enriquecimento_ia_habilitado: z.boolean().optional(),
  bigdatacorp_enrichment_habilitado: z.boolean().optional(),
  whatsapp_oficial_habilitado: z.boolean().optional(),
  conta_teste: z.boolean().optional(),
  teste_expira_em: z.string().nullable().optional(),
  /** Liga: fotografa a tabela de preços de agora para este cliente. Desliga: volta à tabela atual. */
  manterCondicaoPreco: z.boolean().optional(),
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
  if (!parsed.success) return NextResponse.json({ error: erroValidacao(parsed.error), detalhes: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const { data: atual } = await admin.from("profiles").select("conta_teste, condicao_preco").eq("id", userId).maybeSingle();
  if (!atual) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  const { manterCondicaoPreco, ...resto } = parsed.data;
  let campos: Record<string, unknown> = Object.fromEntries(
    Object.entries(resto).filter(([, v]) => v !== undefined),
  );
  // Ligar de novo não refaz a fotografia: a condição antiga continua valendo.
  if (manterCondicaoPreco === true && !atual.condicao_preco) campos.condicao_preco = await capturarCondicaoAtual(admin);
  if (manterCondicaoPreco === false) campos.condicao_preco = null;
  const ficaTeste = parsed.data.conta_teste ?? atual.conta_teste;
  if (parsed.data.conta_teste === true && !atual.conta_teste) {
    campos = { ...campos, ...(await camposAtivacaoContaTeste()) };
  }
  // Conta de teste nunca tem o canal LinkedIn, mesmo que o admin tente ligar.
  if (ficaTeste) campos.linkedin_disparo_habilitado = false;

  const { data: salvo, error } = await admin.from("profiles").update(campos).eq("id", userId).select("condicao_preco").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (manterCondicaoPreco !== undefined) esquecerCondicao(userId);
  return NextResponse.json({ ok: true, telefone: campos.telefone, condicaoPreco: salvo?.condicao_preco ?? null });
}
