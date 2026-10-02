import type { Profile } from "@/lib/database.types";

/**
 * Regras do teste grátis sem dependência de servidor, para usar no proxy
 * (Edge), no layout e nos componentes do menu. O resto fica em teste-gratis.ts.
 */

export function emTesteGratis(profile: Pick<Profile, "teste_gratis" | "assinatura_status" | "role"> | null | undefined): boolean {
  return Boolean(profile?.teste_gratis && profile.assinatura_status !== "ativa" && profile.role !== "admin");
}

/** Páginas que o teste grátis usa de verdade; o resto abre em modo de visualização. */
const PAGINAS_LIBERADAS = ["/busca/cnpj", "/busca/maps", "/historico", "/perfil", "/creditos"];

export function paginaLiberadaNoTeste(pathname: string): boolean {
  if (pathname === "/") return true;
  return PAGINAS_LIBERADAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * APIs de recursos pagos que não têm flag própria no perfil (disparos,
 * enriquecimento e buscas de Instagram/LinkedIn já são bloqueados pelas
 * flags, que nascem desligadas no teste). Checadas no proxy.
 *
 * Leitura (GET) continua liberada para o modo de visualização: a pessoa
 * navega pelas telas, mas nada é criado, alterado, enviado ou conectado.
 * As exceções são GETs que iniciam uma ação (o login com o Google).
 */
const APIS_BLOQUEADAS = ["/api/flows", "/api/funis", "/api/onboarding", "/api/integrations"];
const ACOES_VIA_GET = ["/api/integrations/google-sheets/connect", "/api/integrations/google-sheets/callback"];

const casa = (pathname: string, prefixo: string) => pathname === prefixo || pathname.startsWith(`${prefixo}/`);

export function apiBloqueadaNoTeste(pathname: string, metodo: string): boolean {
  if (ACOES_VIA_GET.some((p) => casa(pathname, p))) return true;
  return metodo.toUpperCase() !== "GET" && APIS_BLOQUEADAS.some((p) => casa(pathname, p));
}

/**
 * No navegador, numa página em modo de visualização: qualquer chamada que
 * altera algo (não-GET em /api) ou que inicia uma ação via GET é barrada
 * antes de sair, e a pessoa vê o convite para assinar.
 */
export function acaoBloqueadaNaVisualizacao(pathname: string, metodo: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  return metodo.toUpperCase() !== "GET" || ACOES_VIA_GET.some((p) => casa(pathname, p));
}

export const MSG_TESTE_GRATIS = "Este recurso faz parte dos planos pagos. No teste grátis você pode extrair empresas por CNPJ e Google Maps.";
