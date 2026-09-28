/** Normaliza e valida um e-mail — retorna "" se inválido. Mirror de phone.ts::normalizarE164. */
export function validarEmail(email: string): string {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}

/** Extrai o domínio (parte depois do @) de um e-mail — usado pra checar contra email_domains verificados. */
export function extrairDominio(email: string): string {
  const partes = (email ?? "").trim().toLowerCase().split("@");
  return partes.length === 2 ? partes[1] : "";
}
