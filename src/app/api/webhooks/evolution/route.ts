import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenWebhookValido } from "@/lib/integrations/evolution-api";
import { chaveTelefone } from "@/lib/contatos";
import { registrarResposta } from "@/lib/funil-automacao";

// Rota PÚBLICA — a Evolution API chama aqui a cada mensagem recebida
// (evento MESSAGES_UPSERT, registrado por configurarWebhookMensagens quando
// o número conecta). Resposta de lead = sai da cadência em todos os canais
// e o card do funil vai pra "Respondeu". Autenticação: header
// x-webhook-token (HMAC do nome da instância) — ver evolution-api.ts.
// Sempre responde 200 pra evento ignorado: a Evolution reenvia em erro.

interface MensagemEvolution {
  key?: { remoteJid?: string; fromMe?: boolean; participant?: string };
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { event?: string; instance?: string; data?: unknown } | null;
  if (!body?.instance) return NextResponse.json({ ok: true });

  const evento = String(body.event || "").toLowerCase().replace(/_/g, ".");
  if (evento !== "messages.upsert") return NextResponse.json({ ok: true });

  if (!(await tokenWebhookValido(body.instance, request.headers.get("x-webhook-token")))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Só mensagem recebida de conversa individual: ignora as que o próprio
  // número mandou (inclusive as da cadência), grupos e status.
  const chaves = mensagens(body.data)
    .filter((m) => m.key?.fromMe === false)
    .map((m) => m.key?.remoteJid || "")
    .filter((jid) => jid.endsWith("@s.whatsapp.net"))
    .map((jid) => chaveTelefone(jid.split("@")[0]))
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
  return NextResponse.json({ ok: true, ...resultado });
}
