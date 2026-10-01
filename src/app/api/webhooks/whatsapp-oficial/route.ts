import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenWebhookConfere } from "@/lib/webhook-token";
import { configPlataforma } from "@/lib/platform-settings";
import { chaveTelefone } from "@/lib/contatos";
import { registrarResposta } from "@/lib/funil-automacao";
import { pedidoDeSaida, registrarOptOutWhatsapp } from "@/lib/opt-out-whatsapp";
import { ESCOPO_WEBHOOK_OFICIAL } from "@/lib/integrations/whatsapp-oficial";

// Rota PÚBLICA — webhook do canal oficial do WhatsApp (Cloud API da Meta,
// ou um provedor que repassa o mesmo formato, como a DatafyAPI).
//
// - GET: verificação da assinatura do webhook (hub.mode=subscribe,
//   hub.verify_token, hub.challenge) — o token é o mesmo do ?token= da URL.
// - POST: `statuses` (sent/delivered/read/failed) atualizam o log de envio
//   pelo id da mensagem (wamid); `messages` são respostas de leads → saem
//   da cadência e o card do funil vai pra "Respondeu".
//
// Autenticação do POST: ?token= na URL (HMAC do servidor, mostrado em
// /admin/disparo) OU assinatura X-Hub-Signature-256 com o App Secret da
// Meta (WHATSAPP_OFICIAL_APP_SECRET), quando o webhook vem direto da Meta.
// Sempre 200 pra evento ignorado: a Meta desativa webhook que erra muito.

const ESCOPO = ESCOPO_WEBHOOK_OFICIAL;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const desafio = url.searchParams.get("hub.challenge") || "";
  const verificacao = url.searchParams.get("hub.verify_token");
  if (modo === "subscribe" && (await tokenWebhookConfere(ESCOPO, verificacao))) {
    return new Response(desafio, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Token de verificação inválido." }, { status: 403 });
}

async function assinaturaMetaValida(corpo: string, assinatura: string | null): Promise<boolean> {
  const segredo = await configPlataforma("whatsapp_oficial_app_secret", process.env.WHATSAPP_OFICIAL_APP_SECRET);
  if (!segredo || !assinatura?.startsWith("sha256=")) return false;
  const esperado = `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;
  return esperado.length === assinatura.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(assinatura));
}

interface ValorWebhook {
  metadata?: { phone_number_id?: string };
  statuses?: Array<{ id?: string; status?: string; errors?: Array<{ title?: string; message?: string; code?: number }> }>;
  messages?: Array<{ from?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } }>;
}

export async function POST(request: Request) {
  const corpo = await request.text();
  const url = new URL(request.url);
  const autorizado = (await tokenWebhookConfere(ESCOPO, url.searchParams.get("token")))
    || (await assinaturaMetaValida(corpo, request.headers.get("x-hub-signature-256")));
  if (!autorizado) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: { entry?: Array<{ changes?: Array<{ field?: string; value?: ValorWebhook }> }> };
  try {
    body = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const sb = createAdminClient();
  const agora = new Date().toISOString();
  let status = 0;
  let respostas = 0;

  for (const entrada of body.entry || []) {
    for (const mudanca of entrada.changes || []) {
      const valor = mudanca.value;
      if (!valor) continue;

      for (const s of valor.statuses || []) {
        if (!s.id) continue;
        status += 1;
        if (s.status === "delivered" || s.status === "read") {
          await sb.from("dispatch_messages_log").update({ entregue_em: agora }).eq("evolution_message_id", s.id).is("entregue_em", null);
        }
        if (s.status === "read") {
          await sb.from("dispatch_messages_log").update({ lido_em: agora }).eq("evolution_message_id", s.id).is("lido_em", null);
        }
        if (s.status === "failed") {
          const motivo = s.errors?.[0]?.message || s.errors?.[0]?.title || "Falha de entrega informada pelo WhatsApp.";
          await sb.from("dispatch_messages_log").update({ status: "erro", erro_msg: motivo.slice(0, 500) }).eq("evolution_message_id", s.id);
        }
      }

      const recebidas = (valor.messages || []).filter((m) => m.from);
      if (!recebidas.length || !valor.metadata?.phone_number_id) continue;
      const { data: instancia } = await sb
        .from("whatsapp_instances").select("user_id").eq("phone_number_id", valor.metadata.phone_number_id).maybeSingle();
      const userId = (instancia as { user_id?: string } | null)?.user_id;
      if (!userId) continue;

      const chaves = recebidas.map((m) => chaveTelefone(m.from!)).filter((c): c is string => Boolean(c));
      if (chaves.length) await registrarResposta(sb, userId, Array.from(new Set(chaves)));
      respostas += chaves.length;
      for (const m of recebidas) {
        const texto = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || "";
        if (pedidoDeSaida(texto)) await registrarOptOutWhatsapp(sb, userId, m.from!, `Pediu pra sair: "${texto}"`);
      }
    }
  }

  return NextResponse.json({ ok: true, status, respostas });
}
