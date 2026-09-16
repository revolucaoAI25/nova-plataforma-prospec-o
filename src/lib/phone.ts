export function apenasDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Converte um telefone em formato livre para E.164 sem o "+" (formato
 * aceito pela Evolution API), assumindo DDI padrão (Brasil) quando ausente.
 * Portado de modules/phone_utils.py.
 */
export function normalizarE164(numero: string, ddiPadrao = "55"): string {
  const d = apenasDigitos(numero);
  if (!d) return "";

  if (d.startsWith(ddiPadrao) && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `${ddiPadrao}${d}`;
  if (d.length >= 12) return d;
  return "";
}

/** Formata um E.164 brasileiro para exibição: 5511999999999 → (11) 99999-9999. */
export function formatarExibicao(numeroE164: string): string {
  let d = apenasDigitos(numeroE164);
  if (d.startsWith("55") && d.length === 13) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numeroE164;
}
