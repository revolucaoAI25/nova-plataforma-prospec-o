import type { AcaoCredito } from "@/lib/database.types";
import type { CanalDisparo, Cenario, ParametrosCenario } from "./cenarios";

// Estimativa determinística de volume e custo de um plano — calculada pelo
// servidor, nunca pela IA (a IA recebe esses números prontos pra argumentar
// e a avaliadora usa pra julgar viabilidade).

export type Tolerancia = "conservador" | "equilibrado" | "agressivo";

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
  };
}

/**
 * Reduz o volume por execução pra (1) não extrair mais do que o canal
 * consegue abordar — o excedente só acumularia na fila e gastaria crédito à
 * toa — e (2) caber em TETO_ORCAMENTO_POR_PLANO dos créditos do mês. Nunca
 * aumenta volume: se a IA pediu pouco, respeita.
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

  const capacidades = cenario.canais.map((c) => capacidadeCanal(c, ctx));
  if (capacidades.length) {
    const maxPeloCanal = Math.max(1, Math.floor(Math.min(...capacidades) / execucoesMes));
    if (porExecucao > maxPeloCanal) {
      ajustes.push(`Volume reduzido de ${porExecucao} para ${maxPeloCanal} leads por execução — é o que o canal consegue abordar com segurança.`);
      porExecucao = maxPeloCanal;
    }
  }

  const custo = custoPorLead(cenario, ctx.custos);
  if (custo > 0 && ctx.creditosMes > 0) {
    const maxPeloOrcamento = Math.max(1, Math.floor((ctx.creditosMes * TETO_ORCAMENTO_POR_PLANO) / custo / execucoesMes));
    if (porExecucao > maxPeloOrcamento) {
      ajustes.push(`Volume reduzido de ${porExecucao} para ${maxPeloOrcamento} leads por execução para caber nos créditos do mês.`);
      porExecucao = maxPeloOrcamento;
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
