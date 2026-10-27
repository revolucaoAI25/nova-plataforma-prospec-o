// Wrapper fino para o canal oficial do WhatsApp (WhatsApp Business Cloud
// API) via um provedor tipo DatafyAPI, que espelha a Cloud API da Meta —
// só mudam URL base e token, campos e formato são os da documentação
// oficial da Meta. Portado de modules/whatsapp_oficial.py.
//
// Cada instância oficial tem suas PRÓPRIAS credenciais (token,
// phone_number_id, waba_id), provisionadas manualmente pelo admin em
// /admin/disparo — por isso recebidas explicitamente em vez de lidas de
// env global (diferente da Evolution API). A URL base, essa sim, é única
// da plataforma: cadastrada em /admin (platform_settings:
// datafy_api_base_url) ou, na ausência, DATAFY_API_BASE_URL do ambiente —
// ver src/lib/platform-settings.ts.
import { configPlataforma } from "@/lib/platform-settings";
import { tokenWebhook, urlBaseApp } from "@/lib/webhook-token";

export const ESCOPO_WEBHOOK_OFICIAL = "whatsapp-oficial";

/**
 * URL e token de verificação do webhook (entregue/lido/resposta) pra
 * cadastrar no painel do provedor ou no app da Meta — mostrados em
 * /admin/disparo. Um webhook só pra plataforma toda: a instância é
 * identificada pelo phone_number_id que vem no evento.
 */
export async function dadosWebhookOficial(): Promise<{ url: string | null; token: string | null }> {
  const base = urlBaseApp();
  const token = await tokenWebhook(ESCOPO_WEBHOOK_OFICIAL);
  return { url: base && token ? `${base}/api/webhooks/whatsapp-oficial?token=${token}` : null, token: token || null };
}

const BASE_PADRAO = "https://cloud.datafyapi.com.br/v1";

async function baseUrl(): Promise<string> {
  const url = await configPlataforma("datafy_api_base_url", process.env.DATAFY_API_BASE_URL || BASE_PADRAO);
  return url.replace(/\/$/, "");
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function req(token: string, path: string, init?: RequestInit) {
  const resp = await fetch(`${await baseUrl()}${path}`, { ...init, headers: headers(token) });
  if (!resp.ok) {
    // A Meta explica o erro em português em error_user_msg (ex.: nome do template inválido).
    const texto = await resp.text();
    let explicacao = "";
    try {
      const j = JSON.parse(texto) as { error?: { error_user_msg?: string; error_user_title?: string; message?: string }; message?: string };
      explicacao = j.error?.error_user_msg || j.error?.message || j.message || "";
    } catch {
      // resposta sem JSON
    }
    throw new Error(explicacao ? `${explicacao} (HTTP ${resp.status})` : `WhatsApp oficial HTTP ${resp.status}: ${texto.slice(0, 300)}`);
  }
  return resp.json();
}

/**
 * IDs ligados ao token do canal na Datafy (GET /me, fora do prefixo /v1):
 * confere o token na hora de provisionar e preenche phone_number_id e
 * waba_id sem o admin precisar copiar do painel.
 */
export async function dadosContaDatafy(token: string): Promise<{ phoneNumberId: string; wabaId: string | null }> {
  const origem = (await baseUrl()).replace(/\/v\d+$/, "");
  const resp = await fetch(`${origem}/me`, { headers: headers(token), signal: AbortSignal.timeout(15_000) });
  if (resp.status === 401) throw new Error("Token do canal inválido. Copie de novo no painel da Datafy.");
  if (resp.status === 402) throw new Error("A assinatura do canal na Datafy está inativa.");
  if (!resp.ok) throw new Error(`A Datafy respondeu ${resp.status} ao conferir o token.`);
  const d = (await resp.json()) as { phone_number_id?: string; waba_id?: string };
  if (!d.phone_number_id) throw new Error("O canal ainda não tem número conectado na Datafy. Conclua a conexão do número no painel deles.");
  return { phoneNumberId: String(d.phone_number_id), wabaId: d.waba_id ? String(d.waba_id) : null };
}

/** Texto livre — só funciona dentro da janela de 24h após o cliente ter mandado mensagem primeiro. */
export async function enviarTexto(token: string, phoneNumberId: string, numeroE164: string, texto: string) {
  return req(token, `/${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", to: numeroE164, type: "text", text: { body: texto } }),
  });
}

/** Único jeito de iniciar contato com quem nunca falou com o número antes. */
export async function enviarTemplate(
  token: string,
  phoneNumberId: string,
  numeroE164: string,
  nomeTemplate: string,
  idioma: string,
  parametrosCorpo: string[] = [],
) {
  const components = parametrosCorpo.length
    ? [{ type: "body", parameters: parametrosCorpo.map((p) => ({ type: "text", text: String(p) })) }]
    : undefined;
  return req(token, `/${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: numeroE164,
      type: "template",
      template: { name: nomeTemplate, language: { code: idioma }, ...(components ? { components } : {}) },
    }),
  });
}

export async function listarTemplates(token: string, wabaId: string) {
  const data = await req(token, `/${wabaId}/message_templates`);
  return data.data || [];
}

/**
 * nomeMeta deve ser único, minúsculo e com underscore. Retorna status PENDING — aprovação demora.
 * Cada variável ({{1}}, {{2}}…) precisa de um exemplo: sem ele a Meta cria o
 * template e o reprova na hora (INVALID_FORMAT).
 */
export async function criarTemplate(
  token: string,
  wabaId: string,
  nomeMeta: string,
  categoria: string,
  idioma: string,
  corpo: string,
  cabecalho = "",
  rodape = "",
  exemplos: { corpo?: string[]; cabecalho?: string } = {},
) {
  const body: Record<string, unknown> = { type: "BODY", text: corpo };
  if (exemplos.corpo?.length) body.example = { body_text: [exemplos.corpo] };
  const components: Array<Record<string, unknown>> = [body];
  if (cabecalho) {
    components.unshift({
      type: "HEADER", format: "TEXT", text: cabecalho,
      ...(exemplos.cabecalho ? { example: { header_text: [exemplos.cabecalho] } } : {}),
    });
  }
  if (rodape) components.push({ type: "FOOTER", text: rodape });
  return req(token, `/${wabaId}/message_templates`, {
    method: "POST",
    body: JSON.stringify({ name: nomeMeta, category: categoria, language: idioma, components }),
  });
}

export async function obterTemplate(token: string, metaTemplateId: string) {
  return req(token, `/${metaTemplateId}`);
}
