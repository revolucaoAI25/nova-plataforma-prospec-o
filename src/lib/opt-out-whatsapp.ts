// Pedido de saída por WhatsApp: o lead responde "sair", "parar", "não quero
// receber"… e o número entra no descadastro do dono (nenhuma campanha dele
// volta a falar com esse número). A resposta em si já tira o lead da
// cadência — isto garante que ele não entra de novo numa campanha futura.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarE164 } from "@/lib/phone";

const PEDIDOS = [
  /^(sair|parar|pare|stop|remover|remova|cancelar|descadastrar)$/,
  /\b(me (tira|tire|remove|remova)|nao (me )?(mande|manda|envie|envia)|nao quero (mais )?receber|para de (me )?mandar|pare de (me )?mandar|descadastr)/,
];

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Mensagem curta pedindo pra parar de receber. Conversa longa não conta (pode ser "não quero receber X, mas…"). */
export function pedidoDeSaida(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const t = normalizar(texto);
  if (!t || t.length > 60) return false;
  return PEDIDOS.some((r) => r.test(t));
}

/** Celular brasileiro chega com e sem o 9 (o WhatsApp às vezes omite): registra as duas formas. */
function variantes(numero: string): string[] {
  const e164 = normalizarE164(numero);
  if (!e164) return [];
  const formas = new Set([e164]);
  if (e164.startsWith("55") && e164.length === 12) formas.add(`${e164.slice(0, 4)}9${e164.slice(4)}`);
  if (e164.startsWith("55") && e164.length === 13 && e164[4] === "9") formas.add(`${e164.slice(0, 4)}${e164.slice(5)}`);
  return Array.from(formas);
}

export async function registrarOptOutWhatsapp(sb: SupabaseClient, userId: string, numero: string, motivo: string) {
  const linhas = variantes(numero).map((telefone) => ({ telefone, user_id: userId, motivo: motivo.slice(0, 200) }));
  if (!linhas.length) return;
  await sb.from("dispatch_opt_outs").upsert(linhas, { onConflict: "telefone,user_id" });
}
