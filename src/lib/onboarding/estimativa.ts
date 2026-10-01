import type { AcaoCredito, PlanFeatureFlags } from "@/lib/database.types";
import type { CanalDisparo, Cenario, ParametrosCenario } from "./cenarios";

// Estimativa determinística de volume e custo de um plano — calculada pelo
// servidor, nunca pela IA (a IA recebe esses números prontos pra argumentar
// e a avaliadora usa pra julgar viabilidade).

export type Tolerancia = "conservador" | "equilibrado" | "agressivo";

/** Plano de assinatura ativo à venda — usado pra recomendar o plano que comporta cada sugestão. */
export interface PlanoVenda {
  nome: string;
  creditosMes: number;
  precoCentavos: number;
  recursos: PlanFeatureFlags;
}

export interface ContextoOrcamento {
  /** Créditos disponíveis por mês: os do plano assinado, ou o saldo atual se não houver plano. */
  creditosMes: number;
  origemCreditos: "plano" | "saldo";
  nomePlano: string | null;
  emailLimiteDiario: number | null;
  tolerancia: Tolerancia;
  /** Tamanho estimado da base própria (cenários de planilha). */
  tamanhoBase: number;
  custos: Record<AcaoCredito, number>;
  /** Contatos novos por mês que o cliente quer abordar (resposta do questionário), quando informado. */
  volumeAlvoMes: number | null;
  planosVenda: PlanoVenda[];
}

export interface Estimativa {
  custoPorLead: number;
  execucoesMes: number;
  leadsExtraidosMes: number;
  capacidadeCanalMes: number | null;
  leadsAbordadosMes: number;
  creditosMes: number;
  percentualOrcamento: number;
  gargalo: "nenhum" | "canal" | "creditos";
  usaOpenai: boolean;
  /** Menor plano à venda que comporta o volume e libera os recursos da sugestão (null = nenhum comporta). Ausente em resultados antigos. */
  planoRecomendado?: string | null;
}

const DIAS_UTEIS_MES = 22;
const SEMANAS_MES = 4.33;
// Teto de uso do orçamento por plano isolado — sobra margem pra rodar mais
// de um plano, pra buscas avulsas e pra variação do volume real.
export const TETO_ORCAMENTO_POR_PLANO = 0.8;

const WHATSAPP_POR_DIA: Record<Tolerancia, number> = { conservador: 40, equilibrado: 80, agressivo: 150 };
const LINKEDIN_POR_DIA: Record<Tolerancia, number> = { conservador: 15, equilibrado: 20, agressivo: 25 };

function capacidadeCanal(canal: CanalDisparo, ctx: ContextoOrcamento): number {
  if (canal === "whatsapp") return WHATSAPP_POR_DIA[ctx.tolerancia] * DIAS_UTEIS_MES;
  if (canal === "linkedin") return LINKEDIN_POR_DIA[ctx.tolerancia] * DIAS_UTEIS_MES;
  return (ctx.emailLimiteDiario || 200) * DIAS_UTEIS_MES;
}

const ALVO_POR_FAIXA: Record<string, number> = {
  ate_300: 250, "300_1000": 650, "1000_3000": 2000, "3000_10000": 6000, acima_10000: 12000,
};

/** Faixa do questionário ("1000_3000") → volume mensal de referência (meio da faixa). */
export function volumeAlvoDe(faixa: string | undefined): number | null {
  return faixa ? ALVO_POR_FAIXA[faixa] ?? null : null;
}

/** Conta de trás pra frente: quantos leads/mês o canal precisa pra bater a meta de reuniões. */
export function leadsParaMeta(metaReunioes: number, canal: CanalDisparo): number {
  // resposta × (resposta → reunião), referências conservadoras de outbound no Brasil.
  const taxa: Record<CanalDisparo, number> = { whatsapp: 0.12 * 0.3, email: 0.03 * 0.3, linkedin: 0.1 * 0.3 };
  return Math.ceil(metaReunioes / taxa[canal]);
}

export function planoQueComporta(creditosMes: number, recursos: (keyof PlanFeatureFlags)[], planos: PlanoVenda[]): string | null {
  const ok = planos
    .filter((p) => p.creditosMes * TETO_ORCAMENTO_POR_PLANO >= creditosMes && recursos.every((r) => p.recursos[r]))
    .sort((a, b) => a.creditosMes - b.creditosMes);
  return ok[0]?.nome ?? null;
}

export function custoPorLead(cenario: Cenario, custos: Record<AcaoCredito, number>): number {
  return cenario.acoesPorLead.reduce((soma, acao) => soma + (custos[acao] ?? 1), 0);
}

export function estimar(cenario: Cenario, p: ParametrosCenario, ctx: ContextoOrcamento): Estimativa {
  const custo = custoPorLead(cenario, ctx.custos);
  const basePropria = cenario.fonte === "base_propria";
  const execucoesMes = basePropria ? 1 : Math.max(1, p.diasSemana.length) * SEMANAS_MES;
  const leadsExtraidosMes = Math.round(basePropria ? ctx.tamanhoBase : p.leadsPorExecucao * execucoesMes);

  // Quando há mais de um canal (multicanal), cada lead passa por todos —
  // o gargalo é o canal mais apertado.
  const capacidades = cenario.canais.map((c) => capacidadeCanal(c, ctx));
  const capacidadeCanalMes = capacidades.length ? Math.min(...capacidades) : null;
  const leadsAbordadosMes = capacidadeCanalMes === null ? leadsExtraidosMes : Math.min(leadsExtraidosMes, capacidadeCanalMes);

  const creditosMes = Math.round(leadsExtraidosMes * custo);
  const percentualOrcamento = ctx.creditosMes > 0 ? creditosMes / ctx.creditosMes : creditosMes > 0 ? Infinity : 0;

  let gargalo: Estimativa["gargalo"] = "nenhum";
  if (percentualOrcamento > 1) gargalo = "creditos";
  else if (capacidadeCanalMes !== null && leadsExtraidosMes > capacidadeCanalMes * 1.1) gargalo = "canal";

  return {
    custoPorLead: custo,
    execucoesMes: Math.round(execucoesMes * 10) / 10,
    leadsExtraidosMes,
    capacidadeCanalMes,
    leadsAbordadosMes,
    creditosMes,
    percentualOrcamento,
    gargalo,
    usaOpenai: cenario.usaOpenai,
    planoRecomendado: planoQueComporta(creditosMes, cenario.recursos, ctx.planosVenda),
  };
}

/**
 * Ajusta o volume por execução: (1) sugestão barata bem abaixo da meta do
 * cliente sobe até a meta; (2) nunca extrai mais do que o canal consegue
 * abordar — o excedente só acumularia na fila gastando crédito; (3) nunca
 * passa do que o maior plano à venda comporta. O saldo atual NÃO limita:
 * a estimativa mostra quantos créditos a sugestão pede e qual plano comporta.
 */
export function ajustarAoOrcamento(
  cenario: Cenario,
  p: ParametrosCenario,
  ctx: ContextoOrcamento,
): { parametros: ParametrosCenario; ajustes: string[] } {
  if (cenario.fonte === "base_propria") {
    // A planilha é processada inteira (não dá pra limitar por execução):
    // o que dá é avisar quantas linhas cabem no orçamento de uma vez.
    const custo = custoPorLead(cenario, ctx.custos);
    const linhasQueCabem = custo > 0 ? Math.floor((ctx.creditosMes * TETO_ORCAMENTO_POR_PLANO) / custo) : Infinity;
    const ajustes = ctx.tamanhoBase > linhasQueCabem
      ? [`Sua base inteira custaria ~${(ctx.tamanhoBase * custo).toLocaleString("pt-BR")} créditos. Coloque na planilha até ${linhasQueCabem.toLocaleString("pt-BR")} linhas por mês e vá acrescentando o resto nos meses seguintes.`]
      : [];
    return { parametros: p, ajustes };
  }

  const ajustes: string[] = [];
  const execucoesMes = Math.max(1, p.diasSemana.length) * SEMANAS_MES;
  let porExecucao = p.leadsPorExecucao;
  const custo = custoPorLead(cenario, ctx.custos);

  const capacidades = cenario.canais.map((c) => capacidadeCanal(c, ctx));
  const maxPeloCanal = capacidades.length ? Math.max(1, Math.floor(Math.min(...capacidades) / execucoesMes)) : Infinity;

  // Volume pela meta do cliente, não pelo saldo de hoje: sugestão barata
  // (até 10 créditos/lead, sem pesquisa por IA) que ficou bem abaixo do que
  // ele quer abordar sobe até a meta, dentro do que o canal aguenta. Antes o
  // volume era cortado pro saldo atual e saía 130 leads/mês pra quem pediu
  // 1.000 a 3.000. Sugestão cara/personalizada mantém o volume que a IA
  // escolheu (pode ser de propósito um teste menor).
  if (ctx.volumeAlvoMes && custo <= 10 && !cenario.usaOpenai && cenario.fonte !== "linkedin") {
    const alvoPorExecucao = Math.min(Math.ceil(ctx.volumeAlvoMes / execucoesMes), maxPeloCanal, cenario.tetoPorExecucao);
    if (porExecucao * execucoesMes < ctx.volumeAlvoMes * 0.7 && alvoPorExecucao > porExecucao) {
      ajustes.push(`Volume ajustado de ${porExecucao} para ${alvoPorExecucao} leads por execução pra chegar perto dos ${ctx.volumeAlvoMes.toLocaleString("pt-BR")} contatos/mês que você quer abordar.`);
      porExecucao = alvoPorExecucao;
    }
  }

  if (porExecucao > maxPeloCanal) {
    ajustes.push(`Volume reduzido de ${porExecucao} para ${maxPeloCanal} leads por execução — é o que o canal consegue abordar com segurança.`);
    porExecucao = maxPeloCanal;
  }

  // Teto: o maior plano à venda. Acima disso não há como pagar o volume.
  const maiorPlano = Math.max(0, ...ctx.planosVenda.map((pl) => pl.creditosMes), ctx.creditosMes);
  if (custo > 0 && maiorPlano > 0) {
    const maxPeloMaiorPlano = Math.max(1, Math.floor((maiorPlano * TETO_ORCAMENTO_POR_PLANO) / custo / execucoesMes));
    if (porExecucao > maxPeloMaiorPlano) {
      ajustes.push(`Volume reduzido de ${porExecucao} para ${maxPeloMaiorPlano} leads por execução — acima disso nenhum plano comporta o custo desta sugestão.`);
      porExecucao = maxPeloMaiorPlano;
    }
  }

  return { parametros: { ...p, leadsPorExecucao: porExecucao }, ajustes };
}

export function tamanhoBaseEstimado(faixa: string | undefined): number {
  if (faixa === "ate_500") return 300;
  if (faixa === "500_5000") return 2000;
  if (faixa === "acima_5000") return 8000;
  return 0;
}

export function toleranciaDe(valor: string | undefined): Tolerancia {
  return valor === "conservador" || valor === "agressivo" ? valor : "equilibrado";
}
