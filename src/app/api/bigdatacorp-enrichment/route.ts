import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarRunBigDataCorp, listarRunsBigDataCorp, perfilComBigDataCorpEnrichmentHabilitado } from "@/lib/bigdatacorp-enrichment-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const runs = await listarRunsBigDataCorp(supabase, user.id);
  return NextResponse.json({ runs });
}

const bodySchema = z.object({
  itens: z.array(z.object({ cnpj: z.string().min(11), nomeLead: z.string().optional() })).min(1).max(50),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComBigDataCorpEnrichmentHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Enriquecimento por CNPJ (BigDataCorp) não habilitado para sua conta." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  const run = await criarRunBigDataCorp(supabase, user.id, parsed.data.itens, "manual");
  if (!run) return NextResponse.json({ error: "Nenhum CNPJ válido no lote (esperado 14 dígitos)." }, { status: 400 });

  // O worker (tickBigDataCorpEnrichment, a cada ~10s) pega execuções
  // "pendente" e processa em background.
  return NextResponse.json({ runId: run.id }, { status: 201 });
}
