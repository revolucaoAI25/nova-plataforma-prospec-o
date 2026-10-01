import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterContaPorUnipileId } from "@/lib/linkedin-dispatch-db";
import { webhookSegredoValido } from "@/lib/integrations/unipile";
import { chaveLinkedin } from "@/lib/contatos";
import { registrarResposta } from "@/lib/funil-automacao";

// Rota PÚBLICA — webhook "messaging" da Unipile. message_received: mensagem
// de um lead em cadência = resposta, sai da cadência em todos os canais e o
// card do funil vai pra "Respondeu". message_read / message_delivered:
// marcam lido/entregue no log de envio (relatório da campanha). Cadastrar na Unipile com
// criarWebhook(`${APP_URL}/api/linkedin-dispatch/webhooks/unipile/messages?secret=...`, "messaging").
//
// Ressalva (igual às outras rotas da Unipile): o schema exato não está
// publicado — lê os campos mais prováveis de forma defensiva e loga o
// payload quando não reconhece.

/**
 * Lida/entregue: a Unipile avisa por chat (e às vezes com o id da
 * mensagem). Ler o chat significa ter lido tudo o que a cadência mandou
 * nele até ali, então marca todas as mensagens daquele alvo ainda sem
 * leitura — mais confiável que depender do id exato de cada mensagem.
 */
async function registrarStatus(body: Record<string, unknown>, evento: string) {
  const unipileAccountId = String(body.account_id || body.accountId || "");
  const chatId = String(body.chat_id || body.chatId || "");
  const messageId = String(body.message_id || body.messageId || "");
  if (!unipileAccountId || (!chatId && !messageId)) return NextResponse.json({ ok: true });

  const sb = createAdminClient();
  const conta = await obterContaPorUnipileId(sb, unipileAccountId);
  if (!conta) return NextResponse.json({ ok: true });

  const agora = new Date().toISOString();
  const lido = evento === "message_read";
  const ids: string[] = [];
  if (chatId) {
    const { data } = await sb
      .from("linkedin_targets")
      .select("id, linkedin_campaigns!inner(account_id)")
      .eq("linkedin_campaigns.account_id", conta.id)
      .eq("chat_id", chatId)
      .limit(5);
    ids.push(...((data ?? []) as { id: string }[]).map((t) => t.id));
  }

  for (const coluna of lido ? ["entregue_em", "lido_em"] : ["entregue_em"]) {
    if (ids.length) {
      await sb.from("linkedin_messages_log").update({ [coluna]: agora })
        .in("target_id", ids).eq("tipo_acao", "mensagem").eq("status", "sucesso").is(coluna, null);
    }
    if (messageId) {
      await sb.from("linkedin_messages_log").update({ [coluna]: agora }).eq("provider_ref", messageId).is(coluna, null);
    }
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!(await webhookSegredoValido(request))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });
  const evento = String(body.event || body.type || "");
  if (evento === "message_read" || evento === "message_delivered") return registrarStatus(body, evento);
  if (evento && evento !== "message_received") return NextResponse.json({ ok: true });

  const unipileAccountId = String(body.account_id || body.accountId || "");
  const chatId = String(body.chat_id || body.chatId || "");
  const remetente = String(body.sender?.attendee_provider_id || body.sender?.provider_id || body.sender_id || "");
  const proprio = String(body.account_info?.user_id || body.account_info?.provider_id || "");
  // Mensagem que a própria conta mandou (inclusive as da cadência) não é resposta.
  if (body.is_sender === true || (remetente && proprio && remetente === proprio)) return NextResponse.json({ ok: true });

  if (!unipileAccountId || (!chatId && !remetente)) {
    console.warn(`[webhook linkedin/messages] payload não reconhecido: ${JSON.stringify(body).slice(0, 500)}`);
    return NextResponse.json({ ok: true });
  }

  const sb = createAdminClient();
  const conta = await obterContaPorUnipileId(sb, unipileAccountId);
  if (!conta) return NextResponse.json({ ok: true });

  const filtros = [chatId && `chat_id.eq.${chatId}`, remetente && `provider_id.eq.${remetente}`].filter(Boolean).join(",");
  const { data } = await sb
    .from("linkedin_targets")
    .select("linkedin_url, linkedin_campaigns!inner(user_id, account_id)")
    .eq("linkedin_campaigns.account_id", conta.id)
    .or(filtros)
    .limit(20);
  const contatos = Array.from(new Set(
    ((data ?? []) as { linkedin_url: string }[]).map((t) => chaveLinkedin(t.linkedin_url)).filter((c): c is string => Boolean(c)),
  ));
  if (!contatos.length) return NextResponse.json({ ok: true });

  const resultado = await registrarResposta(sb, conta.user_id, contatos);
  return NextResponse.json({ ok: true, ...resultado });
}
