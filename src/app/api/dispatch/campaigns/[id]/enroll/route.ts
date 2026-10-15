import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enrollTargets, atualizarCampanha, perfilComDisparoHabilitado } from "@/lib/dispatch-db";
import { buscarLeadsDaPesquisa } from "@/lib/db";
import { comTelefoneDeDestino, preferirCelularDoSocio } from "@/lib/phone";

const bodySchema = z.object({
  searchId: z.string().uuid().optional(),
  leads: z.array(z.object({ nome: z.string().optional(), telefone: z.string() })).optional(),
  /** Pesquisa do histórico: para qual telefone do lead mandar (ver DESTINOS_TELEFONE). */
  telefoneDestino: z.enum(["padrao", "socio", "empresa", "segundo"]).default("padrao"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo não habilitado para sua conta." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  let leads: Array<{ nome?: string | null; telefone?: string | null }> = [];
  let semTelefoneEscolhido = 0;
  if (parsed.data.searchId) {
    const rows = await buscarLeadsDaPesquisa(supabase, parsed.data.searchId);
    // Padrão: busca com "celular do sócio" manda para o celular dele. Dá
    // para escolher o telefone da empresa ou o segundo telefone.
    const destino = parsed.data.telefoneDestino;
    const todos = rows.map((r) => comTelefoneDeDestino(preferirCelularDoSocio({ ...r }) as unknown as Record<string, unknown>, destino));
    leads = todos.filter((l) => String(l.telefone ?? "").trim()) as typeof leads;
    semTelefoneEscolhido = todos.length - leads.length;
    if (!leads.length) {
      return NextResponse.json({ error: "Nenhum lead dessa pesquisa tem o telefone escolhido." }, { status: 400 });
    }
  } else if (parsed.data.leads) {
    // Lista colada: o nome é da pessoa ({{primeiro_nome}} usa ele).
    leads = parsed.data.leads.map((l) => ({ ...l, nome_completo: l.nome ?? "" }));
  } else {
    return NextResponse.json({ error: "Informe searchId ou uma lista de leads." }, { status: 400 });
  }

  if (!leads.length) return NextResponse.json({ error: "Nenhum lead para inscrever." }, { status: 400 });

  const resultado = await enrollTargets(supabase, id, leads);
  if (parsed.data.searchId) {
    await atualizarCampanha(supabase, id, { tipo_origem: "busca_existente", origem_search_id: parsed.data.searchId });
  }

  return NextResponse.json({ ...resultado, sem_telefone_escolhido: semTelefoneEscolhido });
}
