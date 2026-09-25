import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarOptOutEmail } from "@/lib/email-dispatch-db";

// Rota PÚBLICA (sem auth) — link de descadastro que vai no rodapé de todo
// e-mail. O próprio `email_targets.id` é o token (UUID não adivinhável,
// sem precisar de tabela de token separada).
//
// GET só mostra a confirmação (não efetiva nada) e POST efetiva o
// opt-out — evita descadastro acidental por scanners de link corporativos
// (Outlook Safe Links e afins) que pré-buscam todo link de um e-mail via
// GET antes do usuário sequer abrir a mensagem.

// `email` vem de validarEmail() (src/lib/email.ts), cujo regex só exclui
// espaço e "@" — não exclui "<"/">"/aspas — então não é seguro interpolar
// direto no HTML público desta rota sem escapar.
function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paginaHtml(titulo: string, corpo: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #1a1a1a; text-align: center; }
  button { background: #1a1a1a; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; cursor: pointer; }
  p { line-height: 1.5; }
</style>
</head>
<body>${corpo}</body>
</html>`;
}

function html(status: number, titulo: string, corpo: string) {
  return new NextResponse(paginaHtml(titulo, corpo), { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function obterTargetEEmail(sb: ReturnType<typeof createAdminClient>, targetId: string) {
  const { data: target } = await sb.from("email_targets").select("id, email, campaign_id").eq("id", targetId).single();
  if (!target) return null;
  const { data: campanha } = await sb.from("email_campaigns").select("user_id").eq("id", target.campaign_id).single();
  if (!campanha) return null;
  return { target, userId: campanha.user_id as string };
}

export async function GET(request: Request) {
  const targetId = new URL(request.url).searchParams.get("target") || "";
  const sb = createAdminClient();
  const info = targetId ? await obterTargetEEmail(sb, targetId) : null;

  if (!info) {
    return html(404, "Link inválido", "<p>Este link de descadastro não é válido ou já expirou.</p>");
  }

  return html(200, "Cancelar inscrição", `
    <h1>Cancelar inscrição</h1>
    <p>Confirma que não quer mais receber e-mails deste remetente em <strong>${escapeHtml(info.target.email)}</strong>?</p>
    <form method="POST" action="/api/email-dispatch/unsubscribe?target=${encodeURIComponent(targetId)}">
      <button type="submit">Cancelar inscrição</button>
    </form>
  `);
}

export async function POST(request: Request) {
  const targetId = new URL(request.url).searchParams.get("target") || "";
  const sb = createAdminClient();
  const info = targetId ? await obterTargetEEmail(sb, targetId) : null;

  if (!info) {
    return html(404, "Link inválido", "<p>Este link de descadastro não é válido ou já expirou.</p>");
  }

  const { target, userId } = info;

  await sb.from("email_targets").update({ status: "removido", atualizado_em: new Date().toISOString() }).eq("id", target.id);
  await registrarOptOutEmail(sb, target.email, userId, "Descadastro via link no e-mail");

  const { data: outrasCampanhas } = await sb.from("email_campaigns").select("id").eq("user_id", userId);
  const idsCampanhas = (outrasCampanhas || []).map((c) => c.id as string);
  if (idsCampanhas.length) {
    await sb
      .from("email_targets")
      .update({ status: "removido", atualizado_em: new Date().toISOString() })
      .eq("email", target.email)
      .in("campaign_id", idsCampanhas)
      .in("status", ["pendente", "enviando"]);
  }

  return html(200, "Inscrição cancelada", `
    <h1>Inscrição cancelada</h1>
    <p>Você não vai mais receber e-mails deste remetente em <strong>${escapeHtml(target.email)}</strong>.</p>
  `);
}
