import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarE164 } from "@/lib/phone";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/limite-tentativas";
import { camposInicioTesteGratis } from "@/lib/teste-gratis";

/**
 * Cadastro público do teste grátis (página /teste-gratis): cria a conta já
 * com os créditos de teste e deixa a pessoa logada. Sem cobrança, sem
 * CPF/CNPJ. Um teste por e-mail e por WhatsApp.
 */

const texto = (erro: string) => z.string({ error: erro }).trim();

const schema = z.object({
  nome: texto("Informe o seu nome completo.").min(3, "Informe o seu nome completo.").max(120, "Nome muito longo."),
  email: texto("Informe o seu e-mail.").toLowerCase().email("Informe um e-mail válido.").max(200, "E-mail muito longo."),
  telefone: texto("Informe o seu WhatsApp.").max(30, "Telefone inválido."),
  empresa: texto("Informe o nome da sua empresa.").min(2, "Informe o nome da sua empresa.").max(160, "Nome da empresa muito longo."),
  senha: z.string({ error: "Crie uma senha." }).min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72, "A senha pode ter no máximo 72 caracteres."),
  // Campo invisível: pessoas não preenchem, robôs costumam preencher.
  site: z.string().max(0, "Confira os dados informados.").optional(),
});

export async function POST(request: Request) {
  if (!dentroDoLimite(`teste-gratis:${ipDaRequisicao(request)}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Confira os dados informados." }, { status: 400 });
  }
  const dados = parsed.data;

  const telefone = normalizarE164(dados.telefone);
  if (!telefone) return NextResponse.json({ error: "Informe um WhatsApp válido, com DDD." }, { status: 400 });

  const admin = createAdminClient();
  const { count: contasComTelefone } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("telefone", telefone);
  if (contasComTelefone) {
    return NextResponse.json(
      { error: "Este WhatsApp já está cadastrado na plataforma. Entre com a sua conta para continuar.", entrar: true },
      { status: 409 },
    );
  }

  const { data: criado, error: erroCriacao } = await admin.auth.admin.createUser({
    email: dados.email,
    password: dados.senha,
    email_confirm: true,
  });
  if (erroCriacao || !criado.user) {
    const jaExiste = erroCriacao?.code === "email_exists" || /already|registered|exists/i.test(erroCriacao?.message ?? "");
    if (jaExiste) {
      return NextResponse.json(
        { error: "Já existe uma conta com este e-mail. Entre na plataforma para continuar.", entrar: true },
        { status: 409 },
      );
    }
    console.error("[teste-gratis] falha ao criar usuário", erroCriacao);
    return NextResponse.json({ error: "Não foi possível criar a sua conta agora. Tente novamente em instantes." }, { status: 500 });
  }
  const userId = criado.user.id;

  // O trigger handle_new_user já criou o perfil (como 'user'); aqui entram
  // os dados do cliente e os campos do teste.
  const { error: erroPerfil } = await admin
    .from("profiles")
    .update({ nome: dados.nome, telefone, empresa: dados.empresa, ...(await camposInicioTesteGratis()) })
    .eq("id", userId);
  if (erroPerfil) {
    console.error("[teste-gratis] falha ao gravar o perfil", erroPerfil);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Não foi possível criar a sua conta agora. Tente novamente em instantes." }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: erroLogin } = await supabase.auth.signInWithPassword({ email: dados.email, password: dados.senha });
  if (erroLogin) {
    console.error("[teste-gratis] conta criada, mas o login automático falhou", erroLogin);
    return NextResponse.json({ ok: true, proximo: "/login" });
  }
  return NextResponse.json({ ok: true, proximo: "/" });
}
