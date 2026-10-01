// Token dos webhooks que a plataforma registra em terceiros (Evolution,
// canal oficial do WhatsApp): HMAC de um escopo com um segredo do servidor.
// A rota recalcula e compara — nada de token guardado no banco.

import { createHmac, timingSafeEqual } from "node:crypto";
import { configPlataforma } from "@/lib/platform-settings";

async function segredoWebhook(): Promise<string> {
  const proprio = await configPlataforma("webhook_segredo", process.env.WEBHOOK_SECRET);
  return proprio || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export async function tokenWebhook(escopo: string): Promise<string> {
  const segredo = await segredoWebhook();
  if (!segredo) return "";
  return createHmac("sha256", segredo).update(escopo).digest("hex");
}

export async function tokenWebhookConfere(escopo: string, recebido: string | null): Promise<boolean> {
  const esperado = await tokenWebhook(escopo);
  if (!esperado || !recebido || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

export function urlBaseApp(): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return base.startsWith("http") ? base : null;
}
