// API de administração da Datafy (conta de parceiro): cria os canais de
// WhatsApp oficial dos clientes, gera o link de conexão que o cliente abre
// (o fluxo da Meta, com a marca do Leadmatic), assina e cancela os canais
// (a Datafy cobra por canal assinado) e configura o webhook global da
// conta. Autenticação: token de conta `sk_acct_` (platform_settings:
// datafy_account_token, ou DATAFY_ACCOUNT_TOKEN), só no servidor.
// Referência: developers.datafyapi.com.br/api-reference/administracao.
import { configPlataforma } from "@/lib/platform-settings";

const BASE_PADRAO = "https://cloud.datafyapi.com.br";

export class ErroDatafy extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

async function tokenConta(): Promise<string> {
  return (await configPlataforma("datafy_account_token", process.env.DATAFY_ACCOUNT_TOKEN)).trim();
}

export async function parceiroDatafyConfigurado(): Promise<boolean> {
  return Boolean(await tokenConta());
}

/** Raiz da API (sem o /v1 do espelho da Meta): é onde ficam os endpoints de administração. */
async function origem(): Promise<string> {
  const base = await configPlataforma("datafy_api_base_url", process.env.DATAFY_API_BASE_URL || `${BASE_PADRAO}/v1`);
  return base.replace(/\/$/, "").replace(/\/v\d+$/, "");
}

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  const token = await tokenConta();
  if (!token) throw new ErroDatafy(0, "O token de parceiro da Datafy não está configurado em /admin.");
  const resp = await fetch(`${await origem()}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(20_000),
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = typeof corpo?.message === "string" ? corpo.message : `HTTP ${resp.status}`;
    throw new ErroDatafy(resp.status, `Datafy respondeu ${resp.status}: ${msg}`);
  }
  return corpo as T;
}

export interface CanalCriado {
  id: string;
  token: string;
  webhook_secret?: string;
  subscribed: boolean;
}

export interface CanalDatafy {
  id: string;
  name?: string;
  description?: string | null;
  token?: string;
  subscribed: boolean;
  on_trial?: boolean;
  trial_ends_at?: string | null;
  paused?: boolean;
  waba_id?: string | null;
  phone_number_id?: string | null;
  business_id?: string | null;
  phone?: string | null;
  display_name?: string | null;
}

export function criarCanal(nome: string, descricao?: string): Promise<CanalCriado> {
  return req<CanalCriado>("/channels/whatsapp", { method: "POST", body: JSON.stringify({ name: nome.slice(0, 80), description: descricao?.slice(0, 200) }) });
}

/** Todos os canais da conta de parceiro (inclusive os criados no painel da Datafy). Sem o token de cada um. */
export async function listarCanais(): Promise<CanalDatafy[]> {
  const r = await req<{ channels?: CanalDatafy[] }>("/channels/whatsapp");
  return r.channels ?? [];
}

/** Canais que a plataforma cria levam esta descrição; os criados no painel da Datafy, não. */
export const PREFIXO_DESCRICAO_PLATAFORMA = "Usuário ";

export function consultarCanal(id: string): Promise<CanalDatafy> {
  return req<CanalDatafy>(`/channels/whatsapp/${encodeURIComponent(id)}`);
}

/** Link de uso único (vale 24h) que o cliente abre para conectar o número. */
export function gerarLinkConexao(id: string): Promise<{ url: string; expires_in: number }> {
  return req(`/channels/whatsapp/${encodeURIComponent(id)}/connect-link`, { method: "POST" });
}

/** Ativa a cobrança do canal (proporcional ao ciclo da conta, na hora). 402 = cartão da conta recusado. */
export function assinarCanal(id: string): Promise<{ id: string; subscribed: boolean }> {
  return req(`/channels/whatsapp/${encodeURIComponent(id)}/subscribe`, { method: "POST" });
}

/** Cancela a cobrança do canal (o proporcional vira crédito na próxima fatura). */
export function cancelarCanal(id: string): Promise<{ id: string; subscribed: boolean }> {
  return req(`/channels/whatsapp/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

/** Remove o canal (precisa estar sem assinatura). */
export function deletarCanal(id: string): Promise<{ ok: boolean }> {
  return req(`/channels/whatsapp/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Webhook único da conta, que recebe os eventos de todos os canais (substitui o anterior). */
export function configurarWebhookGlobal(url: string): Promise<unknown> {
  return req("/channels/whatsapp/global-webhook", { method: "PUT", body: JSON.stringify({ url, events: ["messages"], enabled: true }) });
}
