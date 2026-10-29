import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { asaasConfigurado } from "@/lib/integrations/asaas";
import { assinarPlano } from "@/lib/subscriptions-db";
import { normalizarE164 } from "@/lib/phone";
import { normalizarCpfCnpj } from "@/lib/cpf-cnpj";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/limite-tentativas";
import type { PlanRow } from "@/lib/database.types";
import { enviarConversaoMeta, origemDaRequisicao, registrarEventoServidor, salvarOrigemNoPerfil } from "@/lib/rastreamento/servidor";
import { registrarLeadLP } from "@/lib/lp-leads";

/**
 * Contratação pública (página /assinar): cria a conta, grava os dados do
 * cliente, abre a assinatura no Asaas e já deixa a pessoa logada. O acesso
 * (créditos e recursos do plano) só é liberado quando o webhook do Asaas
 * confirma o primeiro pagamento — até lá a conta existe com status
 * "pendente". A página manda a pessoa direto para a fatura; /bem-vindo
 * (para onde a fatura devolve) também mostra a fatura enquanto não pagar.
 */

const texto = (erro: string) => z.string({ error: erro }).trim();

const schema = z.object({
  planId: z.string({ error: "Escolha um plano." }).uuid("Plano inválido. Volte e escolha um plano."),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  nome: texto("Informe o seu nome completo.").min(3, "Informe o seu nome completo.").max(120, "Nome muito longo."),
  email: texto("Informe o seu e-mail.").toLowerCase().email("Informe um e-mail válido.").max(200, "E-mail muito longo."),
  telefone: texto("Informe o seu WhatsApp.").max(30, "Telefone inválido."),
  empresa: texto("Informe o nome da sua empresa.").min(2, "Informe o nome da sua empresa.").max(160, "Nome da empresa muito longo."),
  cpfCnpj: texto("Informe o seu CPF ou CNPJ.").max(20, "Informe um CPF ou CNPJ válido."),
  senha: z.string({ error: "Crie uma senha." }).min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72, "A senha pode ter no máximo 72 caracteres."),
  // Campo invisível: pessoas não preenchem, robôs costumam preencher.
  site: z.string().max(0, "Confira os dados informados.").optional(),
});

export async function POST(request: Request) {
  if (!dentroDoLimite(`assinar:${ipDaRequisicao(request)}`, 6, 15 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Confira os dados informados." }, { status: 400 });
  }
  const dados = parsed.data;

  const telefone = normalizarE164(dados.telefone);
  if (!telefone) return NextResponse.json({ error: "Informe um telefone válido, com DDD." }, { status: 400 });
  const cpfCnpj = normalizarCpfCnpj(dados.cpfCnpj);
  if (!cpfCnpj) return NextResponse.json({ error: "Informe um CPF ou CNPJ válido." }, { status: 400 });

  if (!(await asaasConfigurado())) {
    return NextResponse.json({ error: "A contratação online está indisponível no momento. Fale com a nossa equipe." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: planoData } = await admin.from("plans").select("*").eq("id", dados.planId).eq("ativo", true).maybeSingle();
  const plano = planoData as PlanRow | null;
  if (!plano) return NextResponse.json({ error: "Plano não encontrado. Volte e escolha um plano." }, { status: 404 });
  const ciclo = dados.ciclo === "anual" && plano.preco_anual_centavos ? "anual" : "mensal";

  const { data: criado, error: erroCriacao } = await admin.auth.admin.createUser({
    email: dados.email,
    password: dados.senha,
    email_confirm: true,
  });
  if (erroCriacao || !criado.user) {
    const jaExiste = erroCriacao?.code === "email_exists" || /already|registered|exists/i.test(erroCriacao?.message ?? "");
    if (jaExiste) {
      return NextResponse.json(
        { error: "Já existe uma conta com este e-mail. Entre na plataforma para concluir a assinatura.", entrar: true },
        { status: 409 },
      );
    }
    console.error("[assinar] falha ao criar usuário", erroCriacao);
    return NextResponse.json({ error: "Não foi possível criar a sua conta agora. Tente novamente em instantes." }, { status: 500 });
  }
  const userId = criado.user.id;

  // O trigger handle_new_user já criou o perfil (como 'user'); aqui entram os dados do cliente.
  await admin.from("profiles").update({ nome: dados.nome, telefone, empresa: dados.empresa, cpf_cnpj: cpfCnpj }).eq("id", userId);

  // Fatura do 1º pagamento: a página manda a pessoa direto para ela, e a
  // fatura devolve para /bem-vindo (que libera o acesso) depois do pagamento.
  let fatura: string | null = null;
  try {
    const profile = await getProfile(admin, userId);
    if (!profile) throw new Error("Perfil não encontrado após a criação da conta.");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    ({ invoiceUrl: fatura } = await assinarPlano(admin, profile, plano, cpfCnpj, ciclo, appUrl ? `${appUrl}/bem-vindo` : undefined));
  } catch (err) {
    console.error("[assinar] falha ao abrir assinatura", err);
    const { data: aposErro } = await admin.from("profiles").select("asaas_subscription_id").eq("id", userId).maybeSingle();
    if (!aposErro?.asaas_subscription_id) {
      // Nada foi cobrado: desfaz a conta para a pessoa poder tentar de novo do zero.
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Não foi possível gerar a cobrança agora. Tente novamente em instantes." }, { status: 502 });
    }
    // A assinatura existe e só a fatura atrasou: segue para /bem-vindo, que busca a fatura de novo.
  }

  // Origem da conta e conversão de cadastro, depois da resposta. A compra é
  // registrada pelo webhook do Asaas, quando o pagamento é aprovado.
  const origem = origemDaRequisicao(request);
  const eventos = { registro: `registro-${userId}` };
  const valorPlano = (ciclo === "anual" ? (plano.preco_anual_centavos ?? plano.preco_centavos * 12) : plano.preco_centavos) / 100;
  after(async () => {
    await salvarOrigemNoPerfil(userId, origem);
    await registrarEventoServidor("conta_criada", origem, userId, `${plano.nome} (${ciclo})`);
    await registrarLeadLP({
      etapa: "aguardando_pagamento",
      userId,
      origem,
      dados: { nome: dados.nome, email: dados.email, telefone, empresa: dados.empresa, pagina: "assinar", plano: plano.nome, ciclo },
    });
    await enviarConversaoMeta({
      nome: "CompleteRegistration",
      eventId: eventos.registro,
      pessoa: { userId, email: dados.email, telefone, nome: dados.nome, rastreamento: origem },
      pagina: "/assinar",
      valor: valorPlano,
      conteudo: { id: plano.id, nome: plano.nome },
    });
  });

  const supabase = await createClient();
  const { error: erroLogin } = await supabase.auth.signInWithPassword({ email: dados.email, password: dados.senha });
  if (erroLogin) {
    console.error("[assinar] conta criada, mas o login automático falhou", erroLogin);
    return NextResponse.json({ ok: true, proximo: "/login?next=/bem-vindo", fatura, eventos, valor: valorPlano });
  }
  return NextResponse.json({ ok: true, proximo: "/bem-vindo", fatura, eventos, valor: valorPlano });
}
