import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenWebhookValido } from "@/lib/integrations/evolution-api";
import { chaveTelefone } from "@/lib/contatos";
import { registrarResposta } from "@/lib/funil-automacao";
import { pedidoDeSaida, registrarOptOutWhatsapp } from "@/lib/opt-out-whatsapp";

// Rota PÚBLICA — a Evolution API chama aqui a cada mensagem recebida
// (evento MESSAGES_UPSERT, registrado por configurarWebhookMensagens quando
// o número conecta) e a cada mudança de status das enviadas (MESSAGES_UPDATE:
// entregue/lida, gravado no log de envios). Resposta de lead = sai da cadência em todos os canais
// e o card do funil vai pra "Respondeu". Autenticação: header
// x-webhook-token (HMAC do nome da instância) — ver evolution-api.ts.
// Sempre responde 200 pra evento ignorado: a Evolution reenvia em erro.

interface MensagemEvolution {
  key?: { remoteJid?: string; fromMe?: boolean; participant?: string };
  message?: { conversation?: string; extendedTextMessage?: { text?: string } };
}

function mensagens(data: unknown): MensagemEvolution[] {
  if (Array.isArray(data)) return data as MensagemEvolution[];
  if (data && typeof data === "object") {
    const d = data as { messages?: unknown };
    if (Array.isArray(d.messages)) return d.messages as MensagemEvolution[];
    return [data as MensagemEvolution];
  }
  return [];
}

// Status de mensagem enviada. A Evolution v2 manda { keyId, status: "READ" };
// versões antigas repassam o formato do Baileys { key: { id }, update: { status: 4 } }.
// Números do Baileys: 2 = servidor, 3 = entregue, 4 = lida, 5 = áudio ouvido.
interface StatusEvolution {
  keyId?: string;
  messageId?: string;
  key?: { id?: string; fromMe?: boolean };
  fromMe?: boolean;
  status?: string | number;
  update?: { status?: string | number };
}

function nivelStatus(bruto: string | number | undefined): 0 | 1 | 2 {
  if (bruto === undefined || bruto === null) return 0;
  if (typeof bruto === "number") return bruto >= 4 ? 2 : bruto >= 3 ? 1 : 0;
  const s = String(bruto).toUpperCase();
  if (s === "READ" || s === "PLAYED") return 2;
  if (s === "DELIVERY_ACK" || s === "DELIVERED") return 1;
  return 0;
}

async function registrarStatusEnviadas(data: unknown) {
  const itens = (Array.isArray(data) ? data : [data]) as StatusEvolution[];
  const entregues = new Set<string>();
  const lidas = new Set<string>();
  for (const item of itens) {
    if (!item || item.fromMe === false || item.key?.fromMe === false) continue;
    const id = item.keyId || item.key?.id || "";
    const nivel = nivelStatus(item.status ?? item.update?.status);
    if (!id || !nivel) continue;
    entregues.add(id);
    if (nivel === 2) lidas.add(id);
  }
  if (!entregues.size) return { entregues: 0, lidas: 0 };

  const sb = createAdminClient();
  const agora = new Date().toISOString();
  // Só preenche a primeira vez: o evento pode chegar repetido.
  await sb.from("dispatch_messages_log").update({ entregue_em: agora })
    .in("evolution_message_id", Array.from(entregues)).is("entregue_em", null);
  if (lidas.size) {
    await sb.from("dispatch_messages_log").update({ lido_em: agora })
      .in("evolution_message_id", Array.from(lidas)).is("lido_em", null);
  }
  return { entregues: entregues.size, lidas: lidas.size };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { event?: string; instance?: string; data?: unknown } | null;
  if (!body?.instance) return NextResponse.json({ ok: true });

  const evento = String(body.event || "").toLowerCase().replace(/_/g, ".");
  if (evento !== "messages.upsert" && evento !== "messages.update") return NextResponse.json({ ok: true });

  if (!(await tokenWebhookValido(body.instance, request.headers.get("x-webhook-token")))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (evento === "messages.update") {
    const status = await registrarStatusEnviadas(body.data);
    return NextResponse.json({ ok: true, ...status });
  }

  // Só mensagem recebida de conversa individual: ignora as que o próprio
  // número mandou (inclusive as da cadência), grupos e status.
  const recebidas = mensagens(body.data)
    .filter((m) => m.key?.fromMe === false && (m.key?.remoteJid || "").endsWith("@s.whatsapp.net"))
    .map((m) => ({
      numero: (m.key?.remoteJid || "").split("@")[0],
      texto: m.message?.conversation || m.message?.extendedTextMessage?.text || "",
    }));
  const chaves = recebidas
    .map((m) => chaveTelefone(m.numero))
    .filter((c): c is string => Boolean(c));
  if (!chaves.length) return NextResponse.json({ ok: true });

  const sb = createAdminClient();
  const { data: instancia } = await sb
    .from("whatsapp_instances")
    .select("user_id")
    .eq("evolution_instance_name", body.instance)
    .maybeSingle();
  const userId = (instancia as { user_id?: string } | null)?.user_id;
  if (!userId) return NextResponse.json({ ok: true });

  const resultado = await registrarResposta(sb, userId, Array.from(new Set(chaves)));
  for (const m of recebidas) {
    if (pedidoDeSaida(m.texto)) await registrarOptOutWhatsapp(sb, userId, m.numero, `Pediu pra sair: "${m.texto}"`);
  }
  return NextResponse.json({ ok: true, ...resultado });
}
