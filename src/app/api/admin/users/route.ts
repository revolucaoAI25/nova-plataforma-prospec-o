import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { camposAtivacaoContaTeste } from "@/lib/conta-teste";
import { camposDadosCliente, dadosClienteSchema, erroValidacao } from "@/lib/dados-cliente";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  }

  const { data, error } = await createAdminClient().from("user_stats").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

const createSchema = dadosClienteSchema.extend({
  nome: z.string().trim().min(1, "Informe o nome do cliente.").max(120),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["user", "admin"]).default("user"),
  contaTeste: z.boolean().default(false),
  testeExpiraEm: z.string().optional(),
  creditos: z.number().int().min(0).default(0),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: erroValidacao(parsed.error) }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || "Não foi possível criar o usuário." }, { status: 500 });
  }

  // O trigger handle_new_user já cria o perfil (sempre como 'user') — aqui
  // entram o papel pedido, os dados do cliente e os campos de conta de
  // teste (se houver). Conta de teste ignora o saldo informado: recebe a
  // quantidade global configurada.
  let patch: Record<string, unknown> = {
    role: parsed.data.role,
    creditos: parsed.data.creditos,
    ...camposDadosCliente({ nome: parsed.data.nome, telefone: parsed.data.telefone, empresa: parsed.data.empresa }),
  };
  if (parsed.data.contaTeste) {
    patch = {
      ...patch,
      ...(await camposAtivacaoContaTeste()),
      teste_expira_em: parsed.data.testeExpiraEm ? new Date(parsed.data.testeExpiraEm).toISOString() : null,
    };
  }
  const { error: erroPerfil } = await admin.from("profiles").update(patch).eq("id", data.user.id);
  if (erroPerfil) {
    return NextResponse.json(
      { error: `Usuário criado, mas os dados do perfil não foram salvos: ${erroPerfil.message}`, userId: data.user.id },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
