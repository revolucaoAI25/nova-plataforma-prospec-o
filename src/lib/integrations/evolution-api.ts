// Wrapper fino para a Evolution API (gateway WhatsApp não-oficial,
// self-hosted). Auth: header `apikey` (chave global da instância do
// servidor). Portado de modules/evolution_api.py.
//
// Configuração: cadastrada em /admin (platform_settings:
// evolution_api_url, evolution_api_key) ou, na ausência,
// EVOLUTION_API_URL/EVOLUTION_API_KEY do ambiente — ver
// src/lib/platform-settings.ts.
import { configPlataforma } from "@/lib/platform-settings";
import { tokenWebhook, tokenWebhookConfere, urlBaseApp } from "@/lib/webhook-token";

async function baseUrl(): Promise<string> {
  const url = await configPlataforma("evolution_api_url", process.env.EVOLUTION_API_URL);
  return url.replace(/\/$/, "");
}

async function headers(): Promise<Record<string, string>> {
  const chave = await configPlataforma("evolution_api_key", process.env.EVOLUTION_API_KEY);
  return { apikey: chave, "Content-Type": "application/json" };
}

export async function evolutionConfigurado(): Promise<boolean> {
  const [url, chave] = await Promise.all([
    configPlataforma("evolution_api_url", process.env.EVOLUTION_API_URL),
    configPlataforma("evolution_api_key", process.env.EVOLUTION_API_KEY),
  ]);
  return Boolean(url && chave);
}

async function req(path: string, init?: RequestInit) {
  const resp = await fetch(`${await baseUrl()}${path}`, { ...init, headers: await headers() });
  if (!resp.ok) throw new Error(`Evolution API HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

export async function criarInstancia(nomeInstancia: string) {
  return req("/instance/create", {
    method: "POST",
    body: JSON.stringify({ instanceName: nomeInstancia, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
  });
}

export async function obterQrcode(nomeInstancia: string) {
  return req(`/instance/connect/${encodeURIComponent(nomeInstancia)}`);
}

/**
 * Retorna (estado, numero) — `connectionState` tem um bug conhecido na
 * Evolution API onde fica preso em "connecting" mesmo já pareado, então
 * também consulta `fetchInstances`, que reflete o estado real mais rápido
 * e traz o número conectado.
 */
export async function statusENumero(nomeInstancia: string): Promise<{ estado: string; numero: string }> {
  let estadoCs = "";
  try {
    const data = await req(`/instance/connectionState/${encodeURIComponent(nomeInstancia)}`);
    estadoCs = data?.instance?.state || "";
  } catch {
    // segue com fetchInstances
  }

  let estadoFi = "";
  let numero = "";
  try {
    const params = new URLSearchParams({ instanceName: nomeInstancia });
    const itens = await req(`/instance/fetchInstances?${params}`);
    const item = Array.isArray(itens) && itens.length ? itens[0] : {};
    const inst = item?.instance ?? item ?? {};
    estadoFi = inst.connectionStatus || inst.state || "";
    numero = inst.number || (inst.ownerJid || "").split("@")[0] || "";
  } catch {
    // segue com o que já tem
  }

  const estado = estadoCs === "open" || estadoFi === "open" ? "open" : estadoCs || estadoFi || "close";
  return { estado, numero };
}

export async function desconectarInstancia(nomeInstancia: string) {
  await fetch(`${await baseUrl()}/instance/logout/${encodeURIComponent(nomeInstancia)}`, {
    method: "DELETE",
    headers: await headers(),
  });
}

export async function excluirInstancia(nomeInstancia: string) {
  await fetch(`${await baseUrl()}/instance/delete/${encodeURIComponent(nomeInstancia)}`, {
    method: "DELETE",
    headers: await headers(),
  });
}

/** numeroE164 sem "+". Retorna o payload — key.id é o ID da mensagem. */
export async function enviarTexto(nomeInstancia: string, numeroE164: string, texto: string) {
  return req(`/message/sendText/${encodeURIComponent(nomeInstancia)}`, {
    method: "POST",
    body: JSON.stringify({ number: numeroE164, text: texto }),
  });
}

const EXT_PARA_TIPO: Record<string, "image" | "video" | "document"> = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image",
  mp4: "video", mov: "video", webm: "video",
};

/** Deriva o `mediatype` esperado pela Evolution API a partir da extensão da URL — documento por padrão. */
export function tipoMidiaPorUrl(url: string): "image" | "video" | "document" {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  return EXT_PARA_TIPO[ext] || "document";
}

/**
 * Envia mídia (imagem/vídeo/documento) por URL pública, com legenda. Formato
 * documentado do endpoint `/message/sendMedia` — não confirmado contra um
 * servidor real nesta integração (mesma ressalva de outras integrações
 * externas do projeto), mas é o payload padrão da Evolution API v2.
 */
export async function enviarMidia(nomeInstancia: string, numeroE164: string, mediaUrl: string, legenda: string) {
  return req(`/message/sendMedia/${encodeURIComponent(nomeInstancia)}`, {
    method: "POST",
    body: JSON.stringify({ number: numeroE164, mediatype: tipoMidiaPorUrl(mediaUrl), media: mediaUrl, caption: legenda }),
  });
}

// ── Webhook de mensagens recebidas (detecção de resposta) ──────────
// Cada instância registra na Evolution um webhook MESSAGES_UPSERT (resposta)
// e MESSAGES_UPDATE (entregue/lida) apontando pra /api/webhooks/evolution. A autenticação é um token por
// instância (HMAC do nome com um segredo do servidor) mandado num header
// customizado — a rota recalcula e compara, sem guardar token no banco.

export async function tokenWebhookEvolution(nomeInstancia: string): Promise<string> {
  return tokenWebhook(`evolution:${nomeInstancia}`);
}

export async function tokenWebhookValido(nomeInstancia: string, recebido: string | null): Promise<boolean> {
  return tokenWebhookConfere(`evolution:${nomeInstancia}`, recebido);
}

export function urlWebhookEvolution(): string | null {
  const base = urlBaseApp();
  return base ? `${base}/api/webhooks/evolution` : null;
}

/** Registra (ou re-registra) o webhook de mensagens recebidas na instância. Retorna false se não deu. */
export async function configurarWebhookMensagens(nomeInstancia: string): Promise<boolean> {
  const url = urlWebhookEvolution();
  const token = await tokenWebhookEvolution(nomeInstancia);
  if (!url || !token) return false;
  await req(`/webhook/set/${encodeURIComponent(nomeInstancia)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: false,
        headers: { "x-webhook-token": token },
        // UPSERT = mensagem recebida (resposta); UPDATE = status das enviadas (entregue/lida).
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE"],
      },
    }),
  });
  return true;
}
