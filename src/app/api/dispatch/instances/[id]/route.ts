import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterInstancia, deletarInstancia } from "@/lib/dispatch-db";
import { excluirInstancia, desconectarInstancia } from "@/lib/integrations/evolution-api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const instancia = await obterInstancia(supabase, id);
  if (!instancia) return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });

  if (instancia.canal === "evolution" && instancia.evolution_instance_name) {
    try {
      await desconectarInstancia(instancia.evolution_instance_name);
      await excluirInstancia(instancia.evolution_instance_name);
    } catch {
      // segue removendo do banco mesmo se a Evolution API já não tiver a instância
    }
  }

  const ok = await deletarInstancia(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover a instância." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
