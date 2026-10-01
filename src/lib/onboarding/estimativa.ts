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
  /** O que os créditos de hoje (plano ou saldo) pagam por mês, sem passar do sugerido. Ausente em resultados antigos. */
  leadsComportaHojeMes?: number;
  leadsPorExecucaoHoje?: number;
  /** Volume (barata por lead, perto da meta), qualificada (enriquecimento/IA, menos leads) ou base própria. */
  perfil?: "volume" | "qualificada" | "base";
  /** Faixa de reuniões/conversas qualificadas por mês esperada no volume sugerido (null = sem disparo). */
  reunioesMes?: { min: number; max: number } | null;
  /** Créditos por reunião na faixa acima (custo por resultado, não por lead). */
  creditosPorReuniao?: { min: number; max: number } | null;
}

const DIAS_UTEIS_MES = 22;
const SEMANAS_MES = 4.33;
// Teto de uso do orçamento por plano isolado — sobra margem pra rodar mais
// de um plano, pra buscas avulsas e pra variação do volume real.
export const TETO_ORCAMENTO_POR_PLANO = 0.8;

// Mensagens por dia que um número aguenta com segurança, CONTANDO follow-ups.
const WHATSAPP_POR_DIA: Record<Tolerancia, number> = { conservador: 60, equilibrado: 120, agressivo: 200 };
// Convites por dia (as mensagens depois do aceite têm limite próprio).
const LINKEDIN_POR_DIA: Record<Tolerancia, number> = { conservador: 15, equilibrado: 20, agressivo: 25 };
// Mensagens que um lead recebe em média na cadência (quem responde para antes).
const TOQUES_MEDIOS: Record<CanalDisparo, number> = { whatsapp: 4.5, email: 5.5, linkedin: 1 };

/** Leads NOVOS por mês que o canal comporta, já descontando os follow-ups da cadência. */
function capacidadeCanal(canal: CanalDisparo, ctx: ContextoOrcamento): number {
  if (canal === "whatsapp") return Math.floor((WHATSAPP_POR_DIA[ctx.tolerancia] * DIAS_UTEIS_MES) / TOQUES_MEDIOS.whatsapp);
  if (canal === "linkedin") return LINKEDIN_POR_DIA[ctx.tolerancia] * DIAS_UTEIS_MES;
  return Math.floor(((ctx.emailLimiteDiario || 200) * DIAS_UTEIS_MES) / TOQUES_MEDIOS.email);
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

// Faixas conservadoras de outbound no Brasil: resposta por canal × conversa
// que vira reunião/venda. Contato validado do decisor responde mais.
const RESPOSTA: Record<CanalDisparo, [number, number]> = { whatsapp: [0.08, 0.2], email: [0.01, 0.05], linkedin: [0.02, 0.06] };
const RESPOSTA_PARA_REUNIAO: [number, number] = [0.2, 0.35];

function faixaReunioes(cenario: Cenario, leadsMes: number, qualificada: boolean): { min: number; max: number } | null {
  if (!cenario.canais.length) return null;
  // Multicanal: vale a melhor taxa entre os canais, com um pequeno ganho por tocar duas vezes.
  const melhor = cenario.canais.reduce<[number, number]>((acc, c) => [Math.max(acc[0], RESPOSTA[c][0]), Math.max(acc[1], RESPOSTA[c][1])], [0, 0]);
  const bonus = (qualificada ? 1.25 : 1) * (cenario.canais.length > 1 ? 1.15 : 1);
  return {
    min: Math.floor(leadsMes * melhor[0] * bonus * RESPOSTA_PARA_REUNIAO[0]),
    max: Math.ceil(leadsMes * Math.min(0.35, melhor[1] * bonus) * RESPOSTA_PARA_REUNIAO[1]),
  };
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

  // Quanto dá pra rodar só com os créditos de hoje (mesma margem de 80%).
  const porExecucaoHoje = basePropria || custo <= 0 || ctx.creditosMes <= 0
    ? p.leadsPorExecucao
    : Math.max(1, Math.min(p.leadsPorExecucao, Math.floor((ctx.creditosMes * TETO_ORCAMENTO_POR_PLANO) / custo / execucoesMes)));
  const extraidosHoje = basePropria ? leadsExtraidosMes : Math.round(porExecucaoHoje * execucoesMes);
  const leadsComportaHojeMes = capacidadeCanalMes === null ? extraidosHoje : Math.min(extraidosHoje, capacidadeCanalMes);

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
    leadsComportaHojeMes,
    leadsPorExecucaoHoje: porExecucaoHoje,
    perfil: basePropria ? "base" : custo <= 10 && !cenario.usaOpenai ? "volume" : "qualificada",
    reunioesMes: faixaReunioes(cenario, leadsAbordadosMes, custo > 10 || cenario.usaOpenai),
    creditosPorReuniao: (() => {
      const r = faixaReunioes(cenario, leadsAbordadosMes, custo > 10 || cenario.usaOpenai);
      if (!r || !creditosMes) return null;
      return { min: Math.round(creditosMes / Math.max(1, r.max)), max: Math.round(creditosMes / Math.max(1, r.min)) };
    })(),
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

  // Teto: no máximo um degrau acima do que a conta tem hoje (o próximo
  // plano com mais créditos). Sugerir algo que exija três planos acima não
  // ajuda ninguém — fica longe demais da realidade do cliente.
  const planosAcima = ctx.planosVenda.filter((pl) => pl.creditosMes > ctx.creditosMes).sort((a, b) => a.creditosMes - b.creditosMes);
  const degrau = planosAcima[0] ?? null;
  const tetoCreditos = degrau ? degrau.creditosMes : Math.max(ctx.creditosMes, ...ctx.planosVenda.map((pl) => pl.creditosMes));
  const maxPeloTeto = custo > 0 && tetoCreditos > 0
    ? Math.max(1, Math.floor((tetoCreditos * TETO_ORCAMENTO_POR_PLANO) / custo / execucoesMes))
    : Infinity;
  const motivoTeto = degrau ? `o que cabe no plano ${degrau.nome}, o próximo acima do que você tem hoje` : "o máximo que os planos comportam";
  const limitadoTeto = degrau ? `limitado ao plano ${degrau.nome}, o próximo acima do que você tem hoje` : "limitado ao que os planos comportam";

  // Volume pela meta do cliente, não pelo saldo de hoje: sugestão barata
  // (até 10 créditos/lead, sem pesquisa por IA) que ficou bem abaixo do que
  // ele quer abordar sobe até a meta, dentro do canal e do teto. Sugestão
  // cara/personalizada mantém o volume que a IA escolheu (pode ser de
  // propósito um teste menor).
  if (ctx.volumeAlvoMes && custo <= 10 && !cenario.usaOpenai && cenario.fonte !== "linkedin") {
    const pelaMeta = Math.ceil(ctx.volumeAlvoMes / execucoesMes);
    const alvoPorExecucao = Math.min(pelaMeta, maxPeloCanal, maxPeloTeto, cenario.tetoPorExecucao);
    if (porExecucao * execucoesMes < ctx.volumeAlvoMes * 0.7 && alvoPorExecucao > porExecucao) {
      const limite = alvoPorExecucao >= pelaMeta ? "" : alvoPorExecucao === maxPeloTeto ? ` (${limitadoTeto})` : (cenario.canais.includes("whatsapp") ? " (limitado ao que um número de WhatsApp aborda com segurança, contando os follow-ups; com outro número dá pra dobrar)" : " (limitado ao que o canal aborda com segurança, contando os follow-ups)");
      ajustes.push(`Volume ajustado de ${porExecucao} para ${alvoPorExecucao} leads por execução pra chegar perto dos ${ctx.volumeAlvoMes.toLocaleString("pt-BR")} contatos/mês que você quer abordar${limite}.`);
      porExecucao = alvoPorExecucao;
    }
  }

  if (porExecucao > maxPeloCanal) {
    ajustes.push(`Volume reduzido de ${porExecucao} para ${maxPeloCanal} leads por execução — é o que o canal consegue abordar com segurança contando os follow-ups da cadência${cenario.canais.includes("whatsapp") ? " (um número de WhatsApp; pra mais volume, rode a mesma sugestão com outro número)" : ""}.`);
    porExecucao = maxPeloCanal;
  }
  if (porExecucao > maxPeloTeto) {
    ajustes.push(`Volume reduzido de ${porExecucao} para ${maxPeloTeto} leads por execução: é ${motivoTeto}.`);
    porExecucao = maxPeloTeto;
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
