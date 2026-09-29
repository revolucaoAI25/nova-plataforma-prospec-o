import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterConta, perfilComLinkedinDisparoHabilitado, contaPertenceAoUsuario } from "@/lib/linkedin-dispatch-db";
import { criarLinkHostedAuth, unipileConfigurado } from "@/lib/integrations/unipile";

/** Gera um novo link hospedado pra reconectar uma conta com status `requer_reconexao`. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await perfilComLinkedinDisparoHabilitado(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Disparo por LinkedIn não habilitado para sua conta." }, { status: 403 });
  if (!(await unipileConfigurado())) return NextResponse.json({ error: "Disparo por LinkedIn não configurado nesta plataforma." }, { status: 501 });

  const conta = await obterConta(supabase, id);
  if (!conta || !(await contaPertenceAoUsuario(supabase, id, profile))) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  try {
    const link = await criarLinkHostedAuth({
      name: id, tipo: "reconnect",
      successRedirectUrl: `${appUrl}/disparo-linkedin?connected=1`,
      failureRedirectUrl: `${appUrl}/disparo-linkedin?failed=1`,
    });
    return NextResponse.json({ url: link.url });
  } catch (e) {
    return NextResponse.json({ error: `Erro ao gerar o link de reconexão: ${(e as Error).message}` }, { status: 502 });
  }
}
