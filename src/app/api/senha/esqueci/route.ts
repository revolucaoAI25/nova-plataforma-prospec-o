import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { configPlataforma } from "@/lib/platform-settings";
import { enviarEmail, resendConfigurado, textoParaHtml } from "@/lib/integrations/resend";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/limite-tentativas";
import { urlBaseApp } from "@/lib/webhook-token";

/**
 * "Esqueci minha senha" (rota pública): gera o link de recuperação e manda
 * pelo nosso e-mail (Resend, com o remetente da plataforma), em português.
 * O link leva o token no endereço (token_hash), então abre em qualquer
 * aparelho, não só no navegador que pediu.
 *
 * Responde igual com ou sem conta para o e-mail (não revela quem é cliente).
 * Sem o remetente da plataforma configurado, devolve `usarPadrao` e a página
 * usa o envio padrão do Supabase.
 */

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request);
  if (!dentroDoLimite(`senha:${ip}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: "Muitos pedidos seguidos. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  const { email } = parsed.data;

  const remetente = (await configPlataforma("email_remetente_plataforma", process.env.EMAIL_REMETENTE_PLATAFORMA)).trim();
  if (!remetente || !(await resendConfigurado())) return NextResponse.json({ ok: true, usarPadrao: true });

  // Por e-mail também: ninguém enche a caixa de alguém com pedidos.
  if (!dentroDoLimite(`senha-email:${email}`, 3, 60 * 60_000)) return NextResponse.json({ ok: true });

  const base = urlBaseApp() ?? new URL(request.url).origin;
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = data?.properties?.hashed_token;
  // Sem conta para o e-mail (ou falha ao gerar): mesma resposta.
  if (error || !tokenHash) {
    if (error && !/not.?found|no user/i.test(error.message)) console.error("[senha/esqueci] falha ao gerar o link", error.message);
    return NextResponse.json({ ok: true });
  }

  const link = `${base}/auth/confirmar?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=/redefinir-senha/nova`;
  const texto = `Olá!\n\nRecebemos um pedido para criar uma nova senha na sua conta do Leadmatic. Para continuar, abra o link abaixo:\n\n${link}\n\nO link vale por 1 hora e só pode ser usado uma vez.\n\nSe não foi você quem pediu, ignore este e-mail: a sua senha continua a mesma.\n\n—\nEquipe Leadmatic`;
  try {
    await enviarEmail({
      from: remetente,
      to: email,
      replyTo: remetente.match(/<([^>]+)>/)?.[1] ?? remetente,
      subject: "Crie uma nova senha no Leadmatic",
      text: texto,
      html: textoParaHtml(texto),
    });
  } catch (err) {
    console.error("[senha/esqueci] falha ao enviar o e-mail", err);
    return NextResponse.json({ error: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
