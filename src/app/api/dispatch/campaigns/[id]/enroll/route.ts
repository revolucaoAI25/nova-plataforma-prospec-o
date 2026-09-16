import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enrollTargets, atualizarCampanha } from "@/lib/dispatch-db";
import { buscarLeadsDaPesquisa } from "@/lib/db";

const bodySchema = z.object({
  searchId: z.string().uuid().optional(),
  leads: z.array(z.object({ nome: z.string().optional(), telefone: z.string() })).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  let leads: Array<{ nome?: string | null; telefone?: string | null }> = [];
  if (parsed.data.searchId) {
    const rows = await buscarLeadsDaPesquisa(supabase, parsed.data.searchId);
    leads = rows.map((r) => ({ ...r, nome: r.nome, telefone: r.telefone }));
  } else if (parsed.data.leads) {
    leads = parsed.data.leads;
  } else {
    return NextResponse.json({ error: "Informe searchId ou uma lista de leads." }, { status: 400 });
  }

  if (!leads.length) return NextResponse.json({ error: "Nenhum lead para inscrever." }, { status: 400 });

  const resultado = await enrollTargets(supabase, id, leads);
  if (parsed.data.searchId) {
    await atualizarCampanha(supabase, id, { tipo_origem: "busca_existente", origem_search_id: parsed.data.searchId });
  }

  return NextResponse.json(resultado);
}
