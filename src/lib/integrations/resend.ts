// Wrapper fino para a API REST da Resend (https://resend.com) — envio de
// e-mail. Auth: header `Authorization: Bearer <RESEND_API_KEY>` (chave
// única da plataforma, mesmo padrão de CDD_API_KEY/GOOGLE_MAPS_API_KEY:
// usada por todos os remetentes, já que `email_senders` só guarda
// metadados de from/reply-to, não uma credencial própria).
//
// Configuração necessária: RESEND_API_KEY. O domínio usado em
// `from_email` precisa estar verificado no dashboard da Resend
// (Domains → Add Domain, configurando os registros DNS indicados) —
// passo manual do usuário, feito uma vez, fora do código. Sem isso todo
// envio falha.

function baseUrl(): string {
  return "https://api.resend.com";
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`, "Content-Type": "application/json" };
}

export function resendConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function req(path: string, init?: RequestInit) {
  const resp = await fetch(`${baseUrl()}${path}`, { ...init, headers: headers() });
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
