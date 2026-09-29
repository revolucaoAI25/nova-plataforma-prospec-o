// Wrapper fino para a API REST da Resend (https://resend.com) — envio de
// e-mail e verificação de domínio. Auth: header `Authorization: Bearer
// <RESEND_API_KEY>` (chave única da plataforma — todos os domínios de
// todos os usuários são criados sob essa MESMA conta Resend via API, não
// um dashboard por cliente; é o padrão que a própria Resend documenta pra
// plataformas multiusuário).
//
// Configuração: chave cadastrada em /admin (platform_settings, chave
// resend_api_key) ou, na ausência dela, RESEND_API_KEY do ambiente — ver
// src/lib/platform-settings.ts. Cada usuário verifica o PRÓPRIO domínio
// pela nossa UI (`/disparo-email` → Domínios), que chama
// `criarDominioResend()`/`verificarDominioResend()` abaixo — ver
// `email-dispatch-db.ts::criarDominioEmail()` pro fluxo completo,
// inclusive a reconciliação com domínios já existentes na conta.
import { configPlataforma } from "@/lib/platform-settings";

function baseUrl(): string {
  return "https://api.resend.com";
}

async function headers(): Promise<Record<string, string>> {
  const chave = await configPlataforma("resend_api_key", process.env.RESEND_API_KEY);
  return { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" };
}

export async function resendConfigurado(): Promise<boolean> {
  return Boolean(await configPlataforma("resend_api_key", process.env.RESEND_API_KEY));
}

async function req(path: string, init?: RequestInit) {
  const resp = await fetch(`${baseUrl()}${path}`, { ...init, headers: await headers() });
  if (!resp.ok) throw new Error(`Resend HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converte texto simples em HTML mínimo (escape + quebra de linha) — não há editor rico no produto, mesma decisão de manter mensagens como texto puro que o disparo WhatsApp já segue. */
export function textoParaHtml(texto: string): string {
  return escapeHtml(texto).split("\n").join("<br>");
}

export interface EmailEnvio {
  from: string; // "Nome <endereco@dominio>"
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

function paraPayload(envio: EmailEnvio) {
  return {
    from: envio.from, to: envio.to, subject: envio.subject, text: envio.text, html: envio.html,
    ...(envio.replyTo ? { reply_to: envio.replyTo } : {}),
  };
}

/** Envio único — `POST /emails`. */
export async function enviarEmail(envio: EmailEnvio) {
  return req("/emails", { method: "POST", body: JSON.stringify(paraPayload(envio)) });
}

/**
 * Envio em lote — `POST /emails/batch`, até 100 itens por chamada segundo
 * a documentação pública da Resend; formato exato da resposta por item
 * não confirmado contra um servidor real nesta integração (mesma
 * ressalva de outras integrações externas do projeto — ver
 * evolution-api.ts). Resposta esperada: `{ data: [{ id }, ...] }` na
 * mesma ordem dos itens enviados.
 */
export async function enviarLoteEmails(itens: EmailEnvio[]): Promise<Array<{ id: string }>> {
  const resp = await req("/emails/batch", { method: "POST", body: JSON.stringify(itens.map(paraPayload)) });
  return (resp?.data as Array<{ id: string }>) || [];
}

// ── Domínios (verificação por usuário) ────────────────────────────────

export interface ResendDnsRecord {
  record: string;
  name: string;
  value: string;
  type: string;
  status: string;
  ttl: string;
  priority?: number;
}

export interface ResendDominio {
  id: string;
  name: string;
  status: string;
  records: ResendDnsRecord[];
  region?: string;
}

/** `POST /domains` — cria o domínio na conta da plataforma e devolve os registros DNS que o usuário precisa adicionar no provedor dele. */
export async function criarDominioResend(nome: string): Promise<ResendDominio> {
  return req("/domains", { method: "POST", body: JSON.stringify({ name: nome }) });
}

/** `GET /domains` — lista todos os domínios já cadastrados na conta da plataforma (usado pra reconciliar em vez de duplicar um domínio já existente). */
export async function listarDominiosResend(): Promise<ResendDominio[]> {
  const resp = await req("/domains");
  return (resp?.data as ResendDominio[]) || [];
}

/** `GET /domains/{id}` — status atual (inclusive por registro) de um domínio. */
export async function obterDominioResend(resendDomainId: string): Promise<ResendDominio> {
  return req(`/domains/${encodeURIComponent(resendDomainId)}`);
}

/**
 * `POST /domains/{id}/verify` — dispara a checagem assíncrona dos
 * registros DNS. A resposta não confirma sucesso/falha (só que o processo
 * começou) — é preciso um `obterDominioResend()` logo em seguida pra ler o
 * status atualizado, mesma ressalva documentada na doc pública da Resend.
 */
export async function verificarDominioResend(resendDomainId: string): Promise<void> {
  await req(`/domains/${encodeURIComponent(resendDomainId)}/verify`, { method: "POST" });
}

/** `DELETE /domains/{id}` — remove o domínio da conta da plataforma. */
export async function deletarDominioResend(resendDomainId: string): Promise<void> {
  await req(`/domains/${encodeURIComponent(resendDomainId)}`, { method: "DELETE" });
}
