import { normalizarUrlPerfil } from "@/lib/integrations/linkedin";

export { normalizarUrlPerfil };

/**
 * Extrai o "public identifier" (o slug de linkedin.com/in/{slug}) de uma
 * URL de perfil — é esse identificador, não a URL inteira, que a API da
 * Unipile espera em `GET /users/{identifier}` pra resolver o provider_id.
 */
export function extrairIdentificadorPublico(url: string): string {
  const normalizada = normalizarUrlPerfil(url);
  const match = normalizada.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match ? match[1] : "";
}

/** Valida e normaliza uma URL de perfil LinkedIn — retorna "" se inválida. */
export function validarLinkedInUrl(url: string): string {
  const normalizada = normalizarUrlPerfil((url ?? "").trim());
  return extrairIdentificadorPublico(normalizada) ? normalizada : "";
}
