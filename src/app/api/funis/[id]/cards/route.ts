import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { buscarLeadsDaPesquisa } from "@/lib/db";
import { funilPertenceAoUsuario, colunaPertenceAoFunil, adicionarLeadsAoFunil } from "@/lib/funil-db";

const bodySchema = z.object({
  colunaId: z.string().uuid(),
  searchId: z.string().uuid(),
});

/** Adiciona TODOS os leads de uma pesquisa do histórico como cards — mesma granularidade do "Puxar do histórico" já usado nos enriquecimentos, não seleção linha a linha. */
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

  // RLS de `searches` já restringe ao dono — pesquisa de outro usuário
  // simplesmente não retorna leads aqui.
  const leads = await buscarLeadsDaPesquisa(supabase, parsed.data.searchId);
  if (!leads.length) return NextResponse.json({ error: "Nenhum lead encontrado nessa pesquisa." }, { status: 404 });

  const total = await adicionarLeadsAoFunil(
    supabase, id, parsed.data.colunaId, user.id, leads as unknown as Array<Record<string, unknown>>,
  );
  return NextResponse.json({ total });
}
