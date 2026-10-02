import type { Profile } from "@/lib/database.types";

/**
 * Regras do teste grátis sem dependência de servidor, para usar no proxy
 * (Edge), no layout e nos componentes do menu. O resto fica em teste-gratis.ts.
 */

export function emTesteGratis(profile: Pick<Profile, "teste_gratis" | "assinatura_status" | "role"> | null | undefined): boolean {
  return Boolean(profile?.teste_gratis && profile.assinatura_status !== "ativa" && profile.role !== "admin");
}

/** Páginas que o teste grátis abre; o resto mostra o convite para assinar. */
const PAGINAS_LIBERADAS = ["/busca/cnpj", "/busca/maps", "/historico", "/perfil", "/creditos"];

export function paginaLiberadaNoTeste(pathname: string): boolean {
  if (pathname === "/") return true;
  return PAGINAS_LIBERADAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * APIs de recursos pagos que não têm flag própria no perfil (disparos,
 * enriquecimento e buscas de Instagram/LinkedIn já são bloqueados pelas
 * flags, que nascem desligadas no teste). Checadas no proxy.
 */
const APIS_BLOQUEADAS = ["/api/flows", "/api/funis", "/api/onboarding", "/api/integrations"];

export function apiBloqueadaNoTeste(pathname: string): boolean {
  return APIS_BLOQUEADAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const MSG_TESTE_GRATIS = "Este recurso faz parte dos planos pagos. No teste grátis você pode extrair empresas por CNPJ e Google Maps.";
