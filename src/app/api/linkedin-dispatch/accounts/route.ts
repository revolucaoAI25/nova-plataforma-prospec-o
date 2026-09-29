import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarContas, criarConta, atualizarConta, perfilComLinkedinDisparoHabilitado } from "@/lib/linkedin-dispatch-db";
import { criarLinkHostedAuth, unipileConfigurado } from "@/lib/integrations/unipile";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComLinkedinDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo por LinkedIn não habilitado para sua conta." }, { status: 403 });
  }

  const contas = await listarContas(supabase, user.id);
  return NextResponse.json({ contas });
}

const bodySchema = z.object({ nome: z.string().min(1) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await perfilComLinkedinDisparoHabilitado(supabase, user.id))) {
    return NextResponse.json({ error: "Disparo por LinkedIn não habilitado para sua conta." }, { status: 403 });
  }
  if (!(await unipileConfigurado())) {
    return NextResponse.json({ error: "Disparo por LinkedIn não configurado nesta plataforma." }, { status: 501 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome para a conta." }, { status: 400 });

  const id = await criarConta(supabase, user.id, parsed.data.nome);
  if (!id) return NextResponse.json({ error: "Erro ao salvar a conta." }, { status: 500 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  try {
    const link = await criarLinkHostedAuth({
      name: id, tipo: "create",
      successRedirectUrl: `${appUrl}/disparo-linkedin?connected=1`,
      failureRedirectUrl: `${appUrl}/disparo-linkedin?failed=1`,
    });
    return NextResponse.json({ id, url: link.url }, { status: 201 });
  } catch (e) {
    await atualizarConta(supabase, id, { status: "desconectado" });
    return NextResponse.json({ error: `Erro ao gerar o link de conexão: ${(e as Error).message}` }, { status: 502 });
  }
}
