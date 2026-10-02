import { configPlataforma } from "@/lib/platform-settings";
import { PLAN_FEATURE_FLAG_KEYS } from "@/lib/database.types";

export { emTesteGratis, paginaLiberadaNoTeste, MSG_TESTE_GRATIS } from "@/lib/teste-gratis-regras";

/**
 * Teste grátis do cadastro público (/teste-gratis). Não confundir com
 * `conta_teste` (conta de demonstração criada pelo admin, ver conta-teste.ts).
 *
 * A pessoa recebe os créditos configurados (padrão 0: o teste serve para
 * conhecer a plataforma; com créditos, também dá para extrair por CNPJ e
 * Google Maps). O resto da plataforma aparece no menu com cadeado e abre em modo
 * de visualização (dá para ver as telas, não para usar). O bloqueio acaba
 * sozinho quando a assinatura fica ativa.
 */

const CREDITOS_PADRAO = 0;

export async function creditosTesteGratis(): Promise<number> {
  const valor = parseInt(await configPlataforma("creditos_teste_gratis", process.env.CREDITOS_TESTE_GRATIS), 10);
  return Number.isFinite(valor) && valor >= 0 ? valor : CREDITOS_PADRAO;
}

/** Campos gravados no perfil quando o teste começa: só créditos, nenhum recurso de plano. */
export async function camposInicioTesteGratis(): Promise<Record<string, unknown>> {
  const semRecursos = Object.fromEntries(PLAN_FEATURE_FLAG_KEYS.map((k) => [k, false]));
  return { ...semRecursos, teste_gratis: true, creditos: await creditosTesteGratis() };
}

export const MSG_TESTE_GRATIS_ASSINAR = "No teste grátis, os créditos e recursos extras são liberados ao assinar um plano.";

/** Busca sem saldo no teste grátis: a extração é liberada ao assinar. */
export const MSG_TESTE_GRATIS_SEM_CREDITOS = "No teste grátis você conhece a busca, e a extração de empresas é liberada ao assinar um plano.";

