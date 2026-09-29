import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { buscarLeadsDaPesquisa } from "@/lib/db";
import { funilPertenceAoUsuario, colunaPertenceAoFunil, adicionarLeadsAoFunil } from "@/lib/funil-db";

const leadManualSchema = z.object({
  nome: z.string().default(""),
  telefone: z.string().default(""),
  email: z.string().default(""),
  empresa: z.string().default(""),
});

// Duas formas de alimentar uma coluna: `searchId` (toda uma pesquisa do
// histórico, mesma granularidade do "Puxar do histórico" nos
// enriquecimentos) ou `leads` (lote vindo do AdicionarLeadsDialog — 1
// avulso, texto colado ou upload de planilha, já parseados no cliente).
const bodySchema = z.object({
  colunaId: z.string().uuid(),
  searchId: z.string().uuid().optional(),
  leads: z.array(leadManualSchema).min(1).max(200).optional(),
}).refine((v) => Boolean(v.searchId) !== Boolean(v.leads), {
  message: "Informe searchId OU leads, não os dois.",
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!(await funilPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Funil não encontrado." }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  if (!(await colunaPertenceAoFunil(supabase, parsed.data.colunaId, id))) {
    return NextResponse.json({ error: "Coluna não encontrada." }, { status: 404 });
  }

  let leads: Array<Record<string, unknown>>;
  if (parsed.data.searchId) {
    // RLS de `searches` já restringe ao dono — pesquisa de outro usuário
    // simplesmente não retorna leads aqui.
    leads = (await buscarLeadsDaPesquisa(supabase, parsed.data.searchId)) as unknown as Array<Record<string, unknown>>;
    if (!leads.length) return NextResponse.json({ error: "Nenhum lead encontrado nessa pesquisa." }, { status: 404 });
  } else {
    leads = parsed.data.leads!.filter((l) => l.nome.trim() || l.telefone.trim() || l.email.trim());
    if (!leads.length) return NextResponse.json({ error: "Nenhum lead com nome, telefone ou e-mail." }, { status: 400 });
  }

  const total = await adicionarLeadsAoFunil(supabase, id, parsed.data.colunaId, user.id, leads);
  return NextResponse.json({ total });
}
