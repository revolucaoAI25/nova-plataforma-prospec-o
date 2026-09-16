// Wrapper fino para o canal oficial do WhatsApp (WhatsApp Business Cloud
// API) via um provedor tipo DatafyAPI, que espelha a Cloud API da Meta —
// só mudam URL base e token, campos e formato são os da documentação
// oficial da Meta. Portado de modules/whatsapp_oficial.py.
//
// Cada instância oficial tem suas PRÓPRIAS credenciais (token,
// phone_number_id, waba_id) — por isso recebidas explicitamente em vez de
// lidas de env global (diferente da Evolution API).

const BASE_PADRAO = "https://cloud.datafyapi.com.br/v1";

function baseUrl(): string {
  return (process.env.DATAFY_API_BASE_URL || BASE_PADRAO).replace(/\/$/, "");
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function req(token: string, path: string, init?: RequestInit) {
  const resp = await fetch(`${baseUrl()}${path}`, { ...init, headers: headers(token) });
  if (!resp.ok) throw new Error(`WhatsApp oficial HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
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

/** nomeMeta deve ser único, minúsculo e com underscore. Retorna status PENDING — aprovação demora. */
export async function criarTemplate(
  token: string,
  wabaId: string,
  nomeMeta: string,
  categoria: string,
  idioma: string,
  corpo: string,
  cabecalho = "",
  rodape = "",
) {
  const components: Array<Record<string, unknown>> = [{ type: "BODY", text: corpo }];
  if (cabecalho) components.unshift({ type: "HEADER", format: "TEXT", text: cabecalho });
  if (rodape) components.push({ type: "FOOTER", text: rodape });
  return req(token, `/${wabaId}/message_templates`, {
    method: "POST",
    body: JSON.stringify({ name: nomeMeta, category: categoria, language: idioma, components }),
  });
}

export async function obterTemplate(token: string, metaTemplateId: string) {
  return req(token, `/${metaTemplateId}`);
}
