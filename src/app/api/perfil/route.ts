import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { camposDadosCliente, dadosClienteSchema, erroValidacao } from "@/lib/dados-cliente";

/**
 * O cliente corrige o próprio nome, telefone e empresa. Usa a sessão dele
 * (não o service role): o RLS limita à própria linha e o trigger
 * proteger_campos_profile só deixa essas colunas mudarem.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = dadosClienteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: erroValidacao(parsed.error) }, { status: 400 });

  const campos = camposDadosCliente(parsed.data);
  if (!Object.keys(campos).length) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("profiles").update(campos).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar seus dados." }, { status: 500 });
  return NextResponse.json({ ok: true, ...campos });
}
