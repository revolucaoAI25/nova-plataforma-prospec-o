/** Normaliza e valida um e-mail — retorna "" se inválido. Mirror de phone.ts::normalizarE164. */
export function validarEmail(email: string): string {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}
