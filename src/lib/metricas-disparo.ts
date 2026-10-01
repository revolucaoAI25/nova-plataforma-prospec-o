// Métricas de uma campanha de disparo (WhatsApp, e-mail ou LinkedIn), a
// partir do log de envios e dos alvos: funil enviado → entregue → lido →
// respondeu, comparação das variantes do teste A/B e desempenho por etapa.
//
// A variante de um alvo é a do primeiro envio dele (o que de fato recebeu),
// não a sorteada na inscrição: etapa sem texto B conta como A.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Variante } from "@/lib/database.types";

export type CanalMetricas = "whatsapp" | "email" | "linkedin";

const TABELAS: Record<CanalMetricas, { log: string; alvos: string; etapas: string }> = {
  whatsapp: { log: "dispatch_messages_log", alvos: "dispatch_targets", etapas: "dispatch_cadence_steps" },
  email: { log: "email_messages_log", alvos: "email_targets", etapas: "email_cadence_steps" },
  linkedin: { log: "linkedin_messages_log", alvos: "linkedin_targets", etapas: "linkedin_cadence_steps" },
};

export interface Contagem {
  alvos: number;
  entregues: number;
  lidos: number;
  /** E-mail: clicou em algum link. */
  clicados: number;
  /** E-mail: devolvido (bounce) ou marcado como spam. */
  devolvidos: number;
  responderam: number;
  /** LinkedIn: aceitaram o convite. */
  aceitaram: number;
}

export interface MetricasCampanha {
  canal: CanalMetricas;
  total: Contagem;
  variantes: Record<Variante, Contagem>;
  /** Teste A/B rodando (algum alvo recebeu B). */
  testeAtivo: boolean;
  /** Leitura do teste em linguagem simples, quando há dado suficiente. */
  vencedor: { variante: Variante | null; confianca: number; texto: string } | null;
  etapas: Array<{ ordem: number; envios: number; entregues: number; lidos: number; respostasDepois: number }>;
  /** Status de entrega/leitura chega? (algum log com entregue/lido) — se não, a UI explica como ligar. */
  temRecibos: boolean;
}

function vazia(): Contagem {
  return { alvos: 0, entregues: 0, lidos: 0, clicados: 0, devolvidos: 0, responderam: 0, aceitaram: 0 };
}

async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown }>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; de < 50_000; de += 1000) {
    const data = (await consulta(de, de + 999)).data as T[] | null;
    linhas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

/** Teste de duas proporções (z) → confiança de que a diferença não é acaso. */
function confianca(sucessoA: number, nA: number, sucessoB: number, nB: number): number {
  if (nA < 1 || nB < 1) return 0;
  const pA = sucessoA / nA;
  const pB = sucessoB / nB;
  const p = (sucessoA + sucessoB) / (nA + nB);
  const erro = Math.sqrt(p * (1 - p) * (1 / nA + 1 / nB));
  if (!erro) return 0;
  const z = Math.abs(pA - pB) / erro;
  // Aproximação da normal acumulada (Abramowitz-Stegun).
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const cauda = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.round((1 - 2 * cauda) * 100);
}

function lerVencedor(v: Record<Variante, Contagem>, canal: CanalMetricas): MetricasCampanha["vencedor"] {
  const { A, B } = v;
  if (!A.alvos || !B.alvos) return null;
  // Métrica que decide: resposta; no LinkedIn, aceite do convite também conta (vem antes e é mais rápido).
  const usarAceite = canal === "linkedin" && A.responderam + B.responderam < 10;
  const sa = usarAceite ? A.aceitaram : A.responderam;
  const sb = usarAceite ? B.aceitaram : B.responderam;
  const metrica = usarAceite ? "aceite" : "resposta";
  const minimo = 30;
  if (A.alvos < minimo || B.alvos < minimo) {
    return { variante: null, confianca: 0, texto: `Ainda pouco dado: o teste fica confiável a partir de ~${minimo} leads em cada versão (agora ${A.alvos} em A e ${B.alvos} em B).` };
  }
  const taxaA = sa / A.alvos;
  const taxaB = sb / B.alvos;
  const conf = confianca(sa, A.alvos, sb, B.alvos);
  if (taxaA === taxaB || conf < 80) {
    return { variante: null, confianca: conf, texto: `Sem diferença clara de ${metrica} entre A e B por enquanto. Deixe rodar mais.` };
  }
  const ganhou: Variante = taxaB > taxaA ? "B" : "A";
  const fmt = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
  return {
    variante: ganhou,
    confianca: conf,
    texto: `A versão ${ganhou} está ganhando em ${metrica}: ${fmt(ganhou === "B" ? taxaB : taxaA)} contra ${fmt(ganhou === "B" ? taxaA : taxaB)} (${conf}% de confiança).${conf >= 95 ? " Dá pra encerrar o teste e ficar com ela." : ""}`,
  };
}

export async function metricasCampanha(sb: SupabaseClient, canal: CanalMetricas, campaignId: string): Promise<MetricasCampanha> {
  const t = TABELAS[canal];
  const colunasExtra = canal === "email" ? ", clicado_em, devolvido_em, reclamacao_em" : canal === "linkedin" ? ", tipo_acao" : "";
  // string (não literal) pra o parser de tipos do supabase-js não tentar interpretar a seleção montada.
  const colunasLog: string = `target_id, step_id, variante, enviado_em, entregue_em, lido_em${colunasExtra}`;

  const [logs, alvos, etapas] = await Promise.all([
    todas<Record<string, unknown>>((de, ate) => sb.from(t.log)
      .select(colunasLog)
      .eq("campaign_id", campaignId).eq("status", "sucesso").order("enviado_em").range(de, ate)),
    todas<Record<string, unknown>>((de, ate) => sb.from(t.alvos)
      .select("id, status, current_step_id").eq("campaign_id", campaignId).range(de, ate)),
    sb.from(t.etapas).select("id, ordem").eq("campaign_id", campaignId).order("ordem").then((r) => (r.data || []) as Array<Record<string, unknown>>),
  ]);

  // Por alvo: variante do 1º envio e o que aconteceu com qualquer envio dele.
  const porAlvo = new Map<string, { variante: Variante; entregue: boolean; lido: boolean; clicou: boolean; devolvido: boolean; convidado: boolean }>();
  const porEtapa = new Map<string, { envios: number; entregues: number; lidos: number }>();
  for (const l of logs) {
    const id = String(l.target_id);
    const atual = porAlvo.get(id) ?? {
      variante: (l.variante === "B" ? "B" : "A") as Variante, entregue: false, lido: false, clicou: false, devolvido: false, convidado: false,
    };
    // Lido implica entregue (alguns provedores só mandam o evento de leitura).
    atual.entregue ||= Boolean(l.entregue_em || l.lido_em);
    atual.lido ||= Boolean(l.lido_em);
    atual.clicou ||= Boolean(l.clicado_em);
    atual.devolvido ||= Boolean(l.devolvido_em || l.reclamacao_em);
    atual.convidado ||= l.tipo_acao === "convite";
    porAlvo.set(id, atual);

    const stepId = String(l.step_id ?? "");
    const e = porEtapa.get(stepId) ?? { envios: 0, entregues: 0, lidos: 0 };
    e.envios += 1;
    if (l.entregue_em || l.lido_em) e.entregues += 1;
    if (l.lido_em) e.lidos += 1;
    porEtapa.set(stepId, e);
  }

  const statusAlvo = new Map(alvos.map((a) => [String(a.id), a]));
  const respostasPorEtapa = new Map<string, number>();
  const total = vazia();
  const variantes: Record<Variante, Contagem> = { A: vazia(), B: vazia() };
  let temRecibos = false;

  for (const [id, info] of porAlvo) {
    const alvo = statusAlvo.get(id);
    const respondeu = alvo?.status === "respondeu";
    // Convite aceito = alvo saiu de "aguardando_aceite" e seguiu a cadência (ou respondeu).
    const aceitou = canal === "linkedin" && info.convidado && Boolean(alvo) && alvo!.status !== "aguardando_aceite" && alvo!.status !== "falhou" && alvo!.status !== "removido";
    for (const c of [total, variantes[info.variante]]) {
      c.alvos += 1;
      if (info.entregue) c.entregues += 1;
      if (info.lido) c.lidos += 1;
      if (info.clicou) c.clicados += 1;
      if (info.devolvido) c.devolvidos += 1;
      if (respondeu) c.responderam += 1;
      if (aceitou) c.aceitaram += 1;
    }
    if (info.entregue || info.lido) temRecibos = true;
    if (respondeu && alvo?.current_step_id) {
      const step = String(alvo.current_step_id);
      respostasPorEtapa.set(step, (respostasPorEtapa.get(step) ?? 0) + 1);
    }
  }

  return {
    canal,
    total,
    variantes,
    testeAtivo: variantes.B.alvos > 0,
    vencedor: variantes.B.alvos > 0 ? lerVencedor(variantes, canal) : null,
    etapas: etapas.map((e) => {
      const m = porEtapa.get(String(e.id)) ?? { envios: 0, entregues: 0, lidos: 0 };
      return { ordem: Number(e.ordem), ...m, respostasDepois: respostasPorEtapa.get(String(e.id)) ?? 0 };
    }),
    temRecibos,
  };
}
