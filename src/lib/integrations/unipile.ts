// Wrapper fino para a API REST da Unipile (https://unipile.com) — disparo
// por LinkedIn (pedido de conexão e mensagem), via uma conta LinkedIn real
// conectada pelo usuário. Auth: header `X-API-KEY: <UNIPILE_API_KEY>`.
//
// Configuração necessária: UNIPILE_DSN (URL base específica do tenant,
// dada pela Unipile no cadastro — ex: https://apiXXX.unipile.com:XXX) e
// UNIPILE_API_KEY.
//
// Ressalva geral (mesmo espírito de evolution-api.ts/resend.ts): os
// schemas exatos de resposta abaixo foram lidos da documentação pública
// (developer.unipile.com), não confirmados contra um servidor real nesta
// integração — as páginas de doc consultadas nem sempre publicam o schema
// de resposta completo. `POST /chats` e `POST /chats/{chat_id}/messages`
// são documentados como `multipart/form-data`; os demais endpoints não
// especificam content-type explicitamente, então usamos JSON (padrão REST)
// pra eles.

function baseUrl(): string {
  return (process.env.UNIPILE_DSN || "").replace(/\/$/, "");
}

function headersJson(): Record<string, string> {
  return { "X-API-KEY": process.env.UNIPILE_API_KEY || "", "Content-Type": "application/json" };
}

function headersForm(): Record<string, string> {
  return { "X-API-KEY": process.env.UNIPILE_API_KEY || "" };
}

export function unipileConfigurado(): boolean {
  return Boolean(process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY);
}

async function req(path: string, init?: RequestInit) {
  const resp = await fetch(`${baseUrl()}/api/v1${path}`, init);
  if (!resp.ok) throw new Error(`Unipile HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const texto = await resp.text();
  return texto ? JSON.parse(texto) : {};
}

/**
 * Gera um link temporário do assistente de autenticação hospedado pela
 * Unipile — o usuário é redirecionado pra lá, faz login (a Unipile cuida
 * de 2FA/checkpoint) e volta via successRedirectUrl. `name` é ecoado de
 * volta nos eventos de webhook — usado como referência pra casar com
 * nossa linha de `linkedin_accounts`.
 */
export async function criarLinkHostedAuth(params: {
  name: string; tipo: "create" | "reconnect"; successRedirectUrl: string; failureRedirectUrl: string;
}): Promise<{ url: string }> {
  const expiresOn = new Date(Date.now() + 30 * 60_000).toISOString();
  return req("/hosted/accounts/link", {
    method: "POST",
    headers: headersJson(),
    body: JSON.stringify({
      type: params.tipo, providers: ["LINKEDIN"], api_url: baseUrl(), expiresOn,
      name: params.name, success_redirect_url: params.successRedirectUrl, failure_redirect_url: params.failureRedirectUrl,
    }),
  });
}

/**
 * Resolve o "public identifier" (slug de linkedin.com/in/{slug}) pro
 * provider_id interno que os demais endpoints exigem.
 */
export async function resolverPerfil(accountId: string, identificadorPublico: string): Promise<{ provider_id: string; public_identifier?: string }> {
  const params = new URLSearchParams({ account_id: accountId });
  return req(`/users/${encodeURIComponent(identificadorPublico)}?${params}`, { headers: headersJson() });
}

/** Envia um pedido de conexão, com nota opcional. */
export async function enviarConvite(accountId: string, providerId: string, nota?: string): Promise<{ id?: string }> {
  return req("/users/invite", {
    method: "POST",
    headers: headersJson(),
    body: JSON.stringify({ account_id: accountId, provider_id: providerId, ...(nota ? { message: nota } : {}) }),
  });
}

/** Inicia um chat novo com o usuário (só funciona se já for 1º grau, sem InMail) — retorna o chat_id criado. */
export async function criarChat(accountId: string, providerId: string, texto: string): Promise<{ chat_id: string }> {
  const form = new FormData();
  form.append("account_id", accountId);
  form.append("attendees_ids", providerId);
  form.append("text", texto);
  return req("/chats", { method: "POST", headers: headersForm(), body: form });
}

/** Responde num chat já existente (2ª+ mensagem de uma cadência, reaproveitando o chat_id cacheado). */
export async function enviarMensagemChat(chatId: string, texto: string): Promise<{ id?: string }> {
  const form = new FormData();
  form.append("text", texto);
  return req(`/chats/${encodeURIComponent(chatId)}/messages`, { method: "POST", headers: headersForm(), body: form });
}

/**
 * Lista convites de conexão pendentes (ainda não respondidos) de uma
 * conta — usado pelo poll de reforço pra detectar aceite: um convite que
 * SUMIU dessa lista foi aceito ou recusado (mesma estratégia que a doc da
 * Unipile recomenda pra "Detecting Accepted Invitations" quando não dá
 * pra confiar só no webhook `new_relation`, que pode atrasar horas).
 * Schema de resposta menos confirmado desta integração — assume uma lista
 * com `provider_id` por item; ajustar se divergir do formato real.
 */
export async function listarConvitesEnviados(accountId: string): Promise<Array<{ provider_id: string }>> {
  const params = new URLSearchParams({ account_id: accountId });
  const resp = await req(`/users/invite/sent?${params}`, { headers: headersJson() });
  return (resp?.items as Array<{ provider_id: string }>) || [];
}

/**
 * Cria um webhook na Unipile — chamado uma vez (setup manual/script), não
 * a cada request. Pode ser feito também pelo dashboard da Unipile em vez
 * de via API; ambos os caminhos levam ao mesmo endpoint público em
 * `/api/linkedin-dispatch/webhooks/unipile` recebendo os eventos.
 */
export async function criarWebhook(requestUrl: string, source: "account_status" | "users" | "messaging"): Promise<{ id?: string }> {
  return req("/webhooks", {
    method: "POST",
    headers: headersJson(),
    body: JSON.stringify({ request_url: requestUrl, source }),
  });
}
