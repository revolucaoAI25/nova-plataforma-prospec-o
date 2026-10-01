import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { configPlataforma } from "@/lib/platform-settings";
import { registrarOptOutEmail } from "@/lib/email-dispatch-db";

// Rota PÚBLICA — webhook do provedor de e-mail (Resend). Cadastrar no
// painel da Resend → Webhooks, apontando pra /api/webhooks/resend, com os
// eventos email.delivered, email.opened, email.clicked, email.bounced e
// email.complained; o "signing secret" (whsec_…) vai em
// RESEND_WEBHOOK_SECRET (ou no admin, chave resend_webhook_secret).
//
// - delivered/opened/clicked → entregue_em/lido_em/clicado_em no log.
// - bounced (permanente) e complained (marcou como spam) → devolvido_em /
//   reclamacao_em, e o endereço entra no descadastro do dono: insistir em
//   endereço que não existe ou em quem marcou spam derruba a reputação do
//   domínio pra todo mundo.
//
// Assinatura no padrão Svix (headers svix-id, svix-timestamp,
// svix-signature). Sem segredo configurado, recusa tudo: esta rota mexe em
// descadastro.

const TOLERANCIA_SEG = 5 * 60;

async function assinaturaValida(request: Request, corpo: string): Promise<boolean> {
  const segredo = await configPlataforma("resend_webhook_secret", process.env.RESEND_WEBHOOK_SECRET);
  if (!segredo) return false;
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const assinaturas = request.headers.get("svix-signature");
  if (!id || !timestamp || !assinaturas) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCIA_SEG) return false;

  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperado = createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest("base64");
  return assinaturas.split(" ").some((parte) => {
    const [versao, valor] = parte.split(",");
    return versao === "v1" && valor?.length === esperado.length && timingSafeEqual(Buffer.from(valor), Buffer.from(esperado));
  });
}

interface EventoResend {
  type?: string;
  data?: { email_id?: string; to?: string[] | string; bounce?: { type?: string; message?: string } };
}

const COLUNA: Record<string, string> = {
  "email.delivered": "entregue_em",
  "email.opened": "lido_em",
  "email.clicked": "clicado_em",
  "email.bounced": "devolvido_em",
  "email.complained": "reclamacao_em",
};

export async function POST(request: Request) {
  const corpo = await request.text();
  if (!(await assinaturaValida(request, corpo))) return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });

  let evento: EventoResend;
  try {
    evento = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const tipo = String(evento.type || "");
  const coluna = COLUNA[tipo];
  const emailId = evento.data?.email_id;
  if (!coluna || !emailId) return NextResponse.json({ ok: true });

  // Devolução temporária (caixa cheia, servidor fora) não é motivo pra descadastrar.
  const bounceTemporario = tipo === "email.bounced" && /transient|temporary/i.test(String(evento.data?.bounce?.type || ""));
  if (bounceTemporario) return NextResponse.json({ ok: true, ignorado: "devolução temporária" });

  const sb = createAdminClient();
  const agora = new Date().toISOString();
  const campos: Record<string, string> = { [coluna]: agora };
  // Abriu ou clicou = foi entregue, mesmo que o evento de entrega não tenha chegado.
  if (coluna === "lido_em" || coluna === "clicado_em") campos.entregue_em = agora;

  const { data: logs } = await sb
    .from("email_messages_log")
    .select("id, target_id, campaign_id, entregue_em, lido_em")
    .eq("provider_message_id", emailId)
    .limit(5);
  const linhas = (logs ?? []) as Array<{ id: string; target_id: string; campaign_id: string; entregue_em: string | null; lido_em: string | null }>;
  if (!linhas.length) return NextResponse.json({ ok: true });

  for (const l of linhas) {
    const atualizar = { ...campos };
    // Não sobrescreve a primeira vez (abertura repetida, por exemplo).
    if (l.entregue_em) delete atualizar.entregue_em;
    if (coluna === "lido_em" && l.lido_em) delete atualizar.lido_em;
    if (Object.keys(atualizar).length) await sb.from("email_messages_log").update(atualizar).eq("id", l.id);
  }

  if (tipo === "email.bounced" || tipo === "email.complained") {
    const motivo = tipo === "email.bounced" ? `E-mail devolvido${evento.data?.bounce?.message ? `: ${evento.data.bounce.message}` : ""}` : "Marcou o e-mail como spam";
    for (const l of linhas) {
      const { data: alvo } = await sb
        .from("email_targets")
        .select("email, email_campaigns!inner(user_id)")
        .eq("id", l.target_id)
        .maybeSingle();
      const registro = alvo as { email?: string; email_campaigns?: { user_id?: string } | Array<{ user_id?: string }> } | null;
      const dono = Array.isArray(registro?.email_campaigns) ? registro?.email_campaigns[0]?.user_id : registro?.email_campaigns?.user_id;
      if (!registro?.email || !dono) continue;
      await registrarOptOutEmail(sb, registro.email, dono, motivo.slice(0, 200));
      // Sai desta campanha agora; as outras campanhas do dono checam o descadastro antes de cada envio.
      await sb.from("email_targets").update({ status: "removido", atualizado_em: agora })
        .eq("id", l.target_id).in("status", ["pendente", "enviando"]);
    }
  }

  return NextResponse.json({ ok: true });
}
