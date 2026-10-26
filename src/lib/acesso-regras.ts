import { PLAN_FEATURE_FLAG_KEYS, type AssinaturaCiclo, type Profile } from "@/lib/database.types";
import { emTesteGratis } from "@/lib/teste-gratis-regras";

/**
 * Quem pode usar a plataforma. Sem dependência de servidor: roda no proxy
 * (Edge), no layout, no worker e nas rotas.
 *
 * - admin: sempre.
 * - teste grátis: regras próprias (teste-gratis-regras.ts).
 * - ativa: sempre (uma cobrança que falha vira "inadimplente" pelo webhook).
 * - inadimplente: até 3 dias depois do fim do período pago.
 * - cancelada: até o fim do período pago.
 * - pendente / sem_assinatura: se ainda há período pago (cancelou e está
 *   assinando de novo) ou, sem nunca ter pago, se o admin liberou créditos
 *   ou recursos à mão (clientes cadastrados pelo admin).
 *
 * Bloqueado, a pessoa só acessa os planos e o perfil; os dados, listas e
 * campanhas continuam salvos para quando voltar.
 */

export type MotivoBloqueio = "pagamento_pendente" | "pagamento_recusado" | "plano_encerrado" | "sem_plano";

export const CARENCIA_INADIMPLENCIA_MS = 3 * 86_400_000;

export type PerfilAcesso = Pick<Profile, "role" | "teste_gratis" | "assinatura_status" | "creditos" | "acesso_ate"> &
  Partial<Pick<Profile, (typeof PLAN_FEATURE_FLAG_KEYS)[number]>>;

/** Colunas do perfil que a regra lê (para selects enxutos). */
export const COLUNAS_ACESSO = ["role", "teste_gratis", "assinatura_status", "creditos", "acesso_ate", ...PLAN_FEATURE_FLAG_KEYS].join(", ");

function acessoLiberadoPeloAdmin(p: PerfilAcesso): boolean {
  return p.creditos > 0 || PLAN_FEATURE_FLAG_KEYS.some((chave) => Boolean(p[chave]));
}

export function motivoBloqueio(p: PerfilAcesso | null | undefined, agora: number = Date.now()): MotivoBloqueio | null {
  if (!p || p.role === "admin" || emTesteGratis(p)) return null;
  const ate = p.acesso_ate ? Date.parse(p.acesso_ate) : null;
  switch (p.assinatura_status) {
    case "ativa":
      return null;
    case "inadimplente":
      return ate !== null && agora < ate + CARENCIA_INADIMPLENCIA_MS ? null : "pagamento_recusado";
    case "cancelada":
      return ate !== null && agora < ate ? null : "plano_encerrado";
    default: {
      if (ate !== null) return agora < ate ? null : p.assinatura_status === "pendente" ? "pagamento_pendente" : "plano_encerrado";
      if (acessoLiberadoPeloAdmin(p)) return null;
      return p.assinatura_status === "pendente" ? "pagamento_pendente" : "sem_plano";
    }
  }
}

/** Fim do período pago por um pagamento confirmado agora. */
export function fimDoPeriodo(ciclo: AssinaturaCiclo | null | undefined, desde: Date = new Date()): string {
  const fim = new Date(desde);
  const dia = fim.getUTCDate();
  if (ciclo === "anual") fim.setUTCFullYear(fim.getUTCFullYear() + 1);
  else fim.setUTCMonth(fim.getUTCMonth() + 1);
  // 31/01 + 1 mês = 28/02 (não 03/03): mês mais curto fica no último dia.
  if (fim.getUTCDate() !== dia) fim.setUTCDate(0);
  return fim.toISOString();
}

export const MSG_ACESSO_BLOQUEADO: Record<MotivoBloqueio, string> = {
  pagamento_pendente: "Falta concluir o pagamento da sua assinatura para usar a plataforma.",
  pagamento_recusado: "O pagamento da sua assinatura não foi aprovado. Atualize o cartão para voltar a usar a plataforma.",
  plano_encerrado: "O seu plano terminou. Assine de novo para continuar de onde parou.",
  sem_plano: "Escolha um plano para usar a plataforma.",
};

/**
 * APIs que funcionam mesmo com o acesso bloqueado: assinar e pagar, o
 * próprio perfil (dados, senha, tour) e o que é público.
 */
const APIS_LIVRES = [
  "/api/assinatura",
  "/api/assinar",
  "/api/creditos",
  "/api/addons",
  "/api/perfil",
  "/api/settings",
  "/api/teste-gratis",
  "/api/lp",
  "/api/retomada",
  "/api/email-dispatch/unsubscribe",
  "/api/linkedin-dispatch/webhooks",
  "/api/integrations/google-sheets/disconnect",
];

const casa = (pathname: string, prefixo: string) => pathname === prefixo || pathname.startsWith(`${prefixo}/`);

/** Chamadas que o proxy confere contra o acesso: tudo que cria, altera ou envia algo (e os GETs que iniciam ação). */
export function apiConfereAcesso(pathname: string, metodo: string, acaoViaGet: boolean): boolean {
  if (!pathname.startsWith("/api/") || APIS_LIVRES.some((p) => casa(pathname, p))) return false;
  return metodo.toUpperCase() !== "GET" || acaoViaGet;
}

/** Páginas que continuam abertas com o acesso bloqueado. */
export function paginaLiberadaSemAcesso(pathname: string): boolean {
  return ["/creditos", "/perfil"].some((p) => casa(pathname, p));
}
