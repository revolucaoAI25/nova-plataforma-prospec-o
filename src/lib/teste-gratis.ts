import { configPlataforma } from "@/lib/platform-settings";
import { FLAGS_BASE } from "@/lib/database.types";

import { emTesteGratis, situacaoTesteGratis, type SituacaoTeste } from "@/lib/teste-gratis-regras";
import type { Profile } from "@/lib/database.types";

export { emTesteGratis, paginaLiberadaNoTeste, MSG_TESTE_GRATIS, MSG_TESTE_ENCERRADO } from "@/lib/teste-gratis-regras";

/**
 * Teste grátis do cadastro público (/teste-gratis). Não confundir com
 * `conta_teste` (conta de demonstração criada pelo admin, ver conta-teste.ts).
 *
 * A pessoa recebe os créditos configurados (padrão 100) para extrair
 * empresas por CNPJ e Google Maps; com 0, o teste serve só para conhecer a
 * plataforma. O resto da plataforma aparece no menu com cadeado e abre em modo
 * de visualização (dá para ver as telas, não para usar). O bloqueio acaba
 * sozinho quando a assinatura fica ativa.
 */

const CREDITOS_PADRAO = 100;
const DIAS_PADRAO = 7;

/** Duração do teste em dias (configurável em /admin; 0 = sem prazo). */
export async function diasTesteGratis(): Promise<number> {
  const valor = parseInt(await configPlataforma("dias_teste_gratis", process.env.DIAS_TESTE_GRATIS), 10);
  return Number.isFinite(valor) && valor >= 0 ? valor : DIAS_PADRAO;
}

/** Prazo do teste de um perfil (só faz sentido para quem está em teste grátis). */
export async function situacaoTeste(profile: Pick<Profile, "created_at">): Promise<SituacaoTeste> {
  return situacaoTesteGratis(profile.created_at, await diasTesteGratis());
}

/** Teste grátis com o prazo vencido: as ações que gastam créditos ficam bloqueadas até assinar. */
export async function testeGratisEncerrado(profile: Pick<Profile, "teste_gratis" | "assinatura_status" | "role" | "created_at">): Promise<boolean> {
  return emTesteGratis(profile) && (await situacaoTeste(profile)).expirado;
}

export async function creditosTesteGratis(): Promise<number> {
  const valor = parseInt(await configPlataforma("creditos_teste_gratis", process.env.CREDITOS_TESTE_GRATIS), 10);
  return Number.isFinite(valor) && valor >= 0 ? valor : CREDITOS_PADRAO;
}

/** Campos gravados no perfil quando o teste começa: só créditos, nenhum recurso de plano. */
export async function camposInicioTesteGratis(): Promise<Record<string, unknown>> {
  const semRecursos = Object.fromEntries(FLAGS_BASE.map((k) => [k, false]));
  return { ...semRecursos, teste_gratis: true, creditos: await creditosTesteGratis() };
}

export const MSG_TESTE_GRATIS_ASSINAR = "No teste grátis, os créditos e recursos extras são liberados ao assinar um plano.";

/** Busca sem saldo no teste grátis: a extração é liberada ao assinar. */
export const MSG_TESTE_GRATIS_SEM_CREDITOS = "No teste grátis você conhece a busca, e a extração de empresas é liberada ao assinar um plano.";

