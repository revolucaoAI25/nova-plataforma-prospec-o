// Chaves de contato normalizadas — casam a mesma pessoa entre o card do
// funil, os alvos das campanhas de cada canal e as respostas que chegam
// pelos webhooks. Formato: "tel:<DDD><8 últimos dígitos>", "email:<email>",
// "li:<slug do perfil>".
//
// Telefone usa DDD + 8 últimos dígitos (e não o número inteiro) porque o
// WhatsApp às vezes entrega o JID sem o 9º dígito de celulares antigos.
// A mesma regra existe em SQL (chave_telefone, migration 0031) — manter
// as duas iguais.

export function chaveTelefone(bruto: unknown): string | null {
  let d = String(bruto ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  return `tel:${d.slice(0, 2)}${d.slice(-8)}`;
}

export function chaveEmail(bruto: unknown): string | null {
  const e = String(bruto ?? "").trim().toLowerCase();
  return e.includes("@") ? `email:${e}` : null;
}

export function chaveLinkedin(bruto: unknown): string | null {
  const m = String(bruto ?? "").match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? `li:${decodeURIComponent(m[1]).toLowerCase()}` : null;
}

export function contatosDoLead(lead: Record<string, unknown>): string[] {
  const chaves = [chaveTelefone(lead.telefone), chaveEmail(lead.email), chaveLinkedin(lead.linkedin_url)];
  return Array.from(new Set(chaves.filter((c): c is string => Boolean(c))));
}

/** Partes de uma chave de telefone: DDD e os 8 dígitos finais (pra filtrar com LIKE). */
export function partesTelefone(chave: string): { ddd: string; final8: string } | null {
  const m = chave.match(/^tel:(\d{2})(\d{8})$/);
  return m ? { ddd: m[1], final8: m[2] } : null;
}
