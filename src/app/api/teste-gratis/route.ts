import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarE164 } from "@/lib/phone";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/limite-tentativas";
import { camposInicioTesteGratis } from "@/lib/teste-gratis";
import { enviarConversaoMeta, origemDaRequisicao, registrarEventoServidor, salvarOrigemNoPerfil } from "@/lib/rastreamento/servidor";
import { registrarLeadLP } from "@/lib/lp-leads";

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

  // Origem da conta (campanha, Pixel) e conversões: depois da resposta, sem atrasar o cadastro.
  // Os ids voltam para o navegador mandar os mesmos eventos pelo Pixel (a Meta conta uma vez só).
  const origem = origemDaRequisicao(request);
  const eventos = { registro: `registro-${userId}`, teste: `teste-${userId}` };
  after(async () => {
    const pessoa = { userId, email: dados.email, telefone, nome: dados.nome, rastreamento: origem };
    await salvarOrigemNoPerfil(userId, origem);
    await registrarEventoServidor("teste_criado", origem, userId);
    await registrarLeadLP({ etapa: "teste", userId, origem, dados: { nome: dados.nome, email: dados.email, telefone, empresa: dados.empresa, pagina: "teste" } });
    await Promise.all([
      enviarConversaoMeta({ nome: "CompleteRegistration", eventId: eventos.registro, pessoa, pagina: "/teste-gratis", conteudo: { nome: "Teste grátis" } }),
      enviarConversaoMeta({ nome: "StartTrial", eventId: eventos.teste, pessoa, pagina: "/teste-gratis", valor: 0, conteudo: { nome: "Teste grátis" } }),
    ]);
  });

  const supabase = await createClient();
  const { error: erroLogin } = await supabase.auth.signInWithPassword({ email: dados.email, password: dados.senha });
  if (erroLogin) {
    console.error("[teste-gratis] conta criada, mas o login automático falhou", erroLogin);
    return NextResponse.json({ ok: true, proximo: "/login", eventos });
  }
  return NextResponse.json({ ok: true, proximo: "/", eventos });
}
