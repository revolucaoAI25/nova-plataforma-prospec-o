import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularProximaExecucao } from "@/lib/automation-logic";
import { buscarLeadsFiltro } from "@/lib/dispatch-db";
import { getProfile } from "@/lib/credits";
import { lerValores } from "@/lib/integrations/google-sheets";
import { FLOW_NODE_EXECUTORS } from "./executors";
import { FLOW_NODE_TYPES } from "./node-types";
import { interpolarConfig } from "./interpolation";
import type { VariavelEntrada } from "./node-types";
import type { FlowContexto } from "./executor-types";
import type {
  AutomationFlowRow, FlowNode, FlowRunRow, FlowRunStepStatus, FlowNodeTipo, GoogleSheetsCreds, Json,
} from "@/lib/database.types";

/**
 * Motor de execução do construtor de fluxos. Duas responsabilidades bem
 * separadas, chamadas pelo worker (worker/flow-tick.ts) a cada tick:
 *
 * 1. `avaliarGatilhos` — varre TODOS os fluxos ativos sem run em
 *    andamento e decide se o nó-gatilho deve disparar uma `flow_runs` nova.
 * 2. `avancarRuns` — para cada `flow_runs` em `executando`/
 *    `aguardando_subprocesso`, executa o nó atual (via
 *    src/lib/flow/executors) e avança pro próximo nó do grafo.
 *
 * Nenhuma lógica de negócio nova de extração/enriquecimento/disparo/export
 * mora aqui — só orquestração. Cada fluxo tem exatamente 1 nó-gatilho na
 * raiz (validado na API, ver /api/flows) e a execução segue pela saída
 * principal de cada nó. Saídas extras (ex.: "Não atende" de um filtro,
 * "Falhou" de um disparo) abrem uma execução própria, o ramo, que começa
 * no nó ligado àquela saída — ver `abrirRamo` e src/lib/flow/saidas-disparo.ts.
 */

const GATILHO_TIPOS: FlowNodeTipo[] = ["gatilho_agendado", "gatilho_filtro_leads", "gatilho_planilha", "gatilho_manual"];

function noGatilho(flow: AutomationFlowRow): FlowNode | null {
  return flow.nodes.find((n) => GATILHO_TIPOS.includes(n.tipo)) || null;
}

/** Próximo nó pela saída principal (`saida` vazia) ou pela saída pedida. */
export function proximoNo(flow: Pick<AutomationFlowRow, "edges">, deId: string, saida = ""): string | null {
  return flow.edges.find((e) => e.from === deId && (e.saida || "") === saida)?.to ?? null;
}

/** Saídas extras do nó que estão ligadas a algum passo. */
export function saidasConectadas(flow: Pick<AutomationFlowRow, "edges">, noId: string): string[] {
  return flow.edges.filter((e) => e.from === noId && e.saida).map((e) => e.saida as string);
}

// Só a execução principal segura o gatilho: ramos (que podem durar dias
// esperando resultado de disparo) não impedem a próxima execução agendada.
async function temRunAtiva(sb: SupabaseClient, flowId: string): Promise<boolean> {
  const { data } = await sb
    .from("flow_runs")
    .select("id")
    .eq("flow_id", flowId)
    .is("ramo_saida", null)
    .in("status", ["executando", "aguardando_subprocesso"])
    .limit(1);
  return Boolean(data?.length);
}

/**
 * Abre uma execução de ramo: começa no nó ligado à saída `saida` do nó
 * `origemNoId`, com o lote recebido. Devolve o id da execução, ou null se a
 * saída não está ligada a nada (os leads dessa saída são só descartados).
 */
export async function abrirRamo(
  sb: SupabaseClient,
  flow: Pick<AutomationFlowRow, "id" | "user_id" | "edges">,
  origemNoId: string,
  saida: string,
  lote: Array<Record<string, unknown>>,
  extra: { runPaiId?: string | null; variaveis?: Record<string, string> } = {},
): Promise<string | null> {
  const inicio = proximoNo(flow, origemNoId, saida);
  if (!inicio || !lote.length) return null;
  const contexto: FlowContexto = { lote, ...(extra.variaveis ? { variaveis: extra.variaveis } : {}) };
  const { data } = await sb
    .from("flow_runs")
    .insert({
      flow_id: flow.id,
      user_id: flow.user_id,
      status: "executando",
      no_atual_id: inicio,
      contexto: contexto as Json,
      ramo_saida: saida,
      ramo_no_id: origemNoId,
      run_pai_id: extra.runPaiId ?? null,
    })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

async function registrarStepGatilho(sb: SupabaseClient, runId: string, gatilho: FlowNode, contexto: FlowContexto) {
  await sb.from("flow_run_steps").insert({
    run_id: runId,
    node_id: gatilho.id,
    tipo: gatilho.tipo,
    status: "concluido",
    leads_saida: contexto.lote?.length ?? null,
    detalhe: contexto as unknown as Json,
    iniciado_em: new Date().toISOString(),
    concluido_em: new Date().toISOString(),
  });
}

/** Cria uma `flow_runs` a partir do gatilho do fluxo. Retorna o id da run criada, ou null se o fluxo não tem gatilho. */
export async function criarRunDoFluxo(
  sb: SupabaseClient,
  flow: AutomationFlowRow,
  contextoInicial: FlowContexto,
): Promise<string | null> {
  const gatilho = noGatilho(flow);
  if (!gatilho) return null;
  const proximoId = proximoNo(flow, gatilho.id);

  const { data: run } = await sb
    .from("flow_runs")
    .insert({
      flow_id: flow.id,
      user_id: flow.user_id,
      status: proximoId ? "executando" : "concluido",
      no_atual_id: proximoId,
      contexto: contextoInicial as Json,
      concluido_em: proximoId ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (!run) return null;

  await registrarStepGatilho(sb, run.id as string, gatilho, contextoInicial);
  return run.id as string;
}

/**
 * Disparo manual (botão "Executar agora") — ignora agendamento/estado do
 * gatilho. `variaveisEntrada` sobrescreve os valores padrão declarados no
 * nó `gatilho_manual` (variável não informada cai no padrão); o resultado
 * fica em `contexto.variaveis`, disponível nos nós seguintes via
 * `{{variaveis.chave}}` (ver src/lib/flow/interpolation.ts).
 */
export async function dispararManualmente(
  sb: SupabaseClient,
  flow: AutomationFlowRow,
  variaveisEntrada: Record<string, string> = {},
): Promise<{ ok: boolean; erro?: string; runId?: string }> {
  const gatilho = noGatilho(flow);
  if (!gatilho) return { ok: false, erro: "O fluxo não tem um nó de gatilho." };
  if (await temRunAtiva(sb, flow.id)) return { ok: false, erro: "Já existe uma execução em andamento para este fluxo." };

  const declaradas = Array.isArray((gatilho.config as { variaveis?: unknown })?.variaveis)
    ? ((gatilho.config as { variaveis: VariavelEntrada[] }).variaveis)
    : [];
  const variaveis: Record<string, string> = {};
  for (const v of declaradas) variaveis[v.chave] = variaveisEntrada[v.chave] ?? v.padrao;

  const runId = await criarRunDoFluxo(sb, flow, { variaveis });
  if (!runId) return { ok: false, erro: "Não foi possível criar a execução." };
  return { ok: true, runId };
}

// ── Avaliação de gatilhos ──────────────────────────────────────────

async function avaliarGatilhoAgendado(sb: SupabaseClient, flow: AutomationFlowRow, gatilho: FlowNode, log: (m: string) => void) {
  const config = (gatilho.config || {}) as Record<string, unknown>;
  const diasSemana = Array.isArray(config.diasSemana) ? (config.diasSemana as number[]) : [];
  const horario = String(config.horario || "");
  const estado = (flow.gatilho_estado || {}) as Record<string, unknown>;
  const proximaIso = estado.proximaExecucao as string | undefined;

  if (!proximaIso) {
    const proxima = calcularProximaExecucao(diasSemana, horario);
    if (proxima) {
      await sb.from("automation_flows").update({ gatilho_estado: { ...estado, proximaExecucao: proxima.toISOString() } }).eq("id", flow.id);
    }
    return;
  }
  if (new Date(proximaIso) > new Date()) return;

  await criarRunDoFluxo(sb, flow, {});
  const proxima = calcularProximaExecucao(diasSemana, horario);
  await sb.from("automation_flows").update({
    gatilho_estado: { ...estado, proximaExecucao: proxima ? proxima.toISOString() : null, ultimaExecucao: new Date().toISOString() },
  }).eq("id", flow.id);
  log(`Fluxo ${flow.id}: gatilho agendado disparou.`);
}

async function avaliarGatilhoFiltroLeads(sb: SupabaseClient, flow: AutomationFlowRow, gatilho: FlowNode, log: (m: string) => void) {
  const config = (gatilho.config || {}) as Record<string, unknown>;
  const estado = (flow.gatilho_estado || {}) as Record<string, unknown>;
  const desde = (estado.ultimoTriggerEm as string) || null;

  const leads = await buscarLeadsFiltro(
    sb, flow.user_id, String(config.nicho || ""), String(config.subnicho || ""), String(config.uf || ""), desde,
  );
  const agoraIso = new Date().toISOString();
  if (!leads.length) {
    await sb.from("automation_flows").update({ gatilho_estado: { ...estado, ultimoTriggerEm: agoraIso } }).eq("id", flow.id);
    return;
  }

  await criarRunDoFluxo(sb, flow, { lote: leads as unknown as Record<string, unknown>[] });
  await sb.from("automation_flows").update({ gatilho_estado: { ...estado, ultimoTriggerEm: agoraIso } }).eq("id", flow.id);
  log(`Fluxo ${flow.id}: gatilho de novo lead disparou com ${leads.length} lead(s).`);
}

async function avaliarGatilhoPlanilha(sb: SupabaseClient, flow: AutomationFlowRow, gatilho: FlowNode, log: (m: string) => void) {
  const config = (gatilho.config || {}) as Record<string, unknown>;
  const sheetId = String(config.sheetId || "");
  const abaNome = String(config.abaNome || "");
  const colunaTelefone = String(config.colunaTelefone || "telefone");
  const colunaNome = config.colunaNome ? String(config.colunaNome) : "";
  if (!sheetId || !abaNome) return;

  const profile = await getProfile(sb, flow.user_id);
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds | null)?.oauth;
  if (!creds) return;

  let valores: string[][];
  try {
    valores = await lerValores(creds, sheetId, abaNome);
  } catch (e) {
    log(`Fluxo ${flow.id}: erro lendo planilha do gatilho: ${(e as Error).message}`);
    return;
  }
  if (!valores.length) return;

  const [cabecalho, ...linhas] = valores;
  const estado = (flow.gatilho_estado || {}) as Record<string, unknown>;
  const jaProcessadas = Number(estado.ultimaLinhaProcessada || 0);
  const novas = linhas.slice(jaProcessadas);
  if (!novas.length) return;

  const idxTel = cabecalho.indexOf(colunaTelefone);
  if (idxTel < 0) {
    log(`Fluxo ${flow.id}: coluna de telefone '${colunaTelefone}' não existe mais no cabeçalho da planilha.`);
    return;
  }
  const idxNome = colunaNome ? cabecalho.indexOf(colunaNome) : -1;

  const lote = novas.map((linha) => {
    const lead: Record<string, unknown> = {};
    cabecalho.forEach((col, i) => { lead[col] = linha[i] ?? ""; });
    lead.telefone = linha[idxTel] ?? "";
    lead.nome = idxNome >= 0 ? linha[idxNome] ?? "" : "";
    return lead;
  });

  await criarRunDoFluxo(sb, flow, { lote });
  await sb.from("automation_flows").update({ gatilho_estado: { ...estado, ultimaLinhaProcessada: linhas.length } }).eq("id", flow.id);
  log(`Fluxo ${flow.id}: gatilho de planilha disparou com ${lote.length} linha(s) nova(s).`);
}

/** Varre fluxos ativos sem run em andamento e dispara os que estão vencidos. */
export async function avaliarGatilhos(sb: SupabaseClient, log: (m: string) => void): Promise<void> {
  const { data } = await sb.from("automation_flows").select("*").eq("ativo", true);
  const flows = (data as AutomationFlowRow[]) || [];

  for (const flow of flows) {
    try {
      const gatilho = noGatilho(flow);
      if (!gatilho || gatilho.tipo === "gatilho_manual") continue;
      if (await temRunAtiva(sb, flow.id)) continue;

      if (gatilho.tipo === "gatilho_agendado") await avaliarGatilhoAgendado(sb, flow, gatilho, log);
      else if (gatilho.tipo === "gatilho_filtro_leads") await avaliarGatilhoFiltroLeads(sb, flow, gatilho, log);
      else if (gatilho.tipo === "gatilho_planilha") await avaliarGatilhoPlanilha(sb, flow, gatilho, log);
    } catch (e) {
      log(`Fluxo ${flow.id}: erro avaliando gatilho: ${(e as Error).message}`);
    }
  }
}

// ── Avanço de runs ativas ──────────────────────────────────────────

async function upsertStep(
  sb: SupabaseClient,
  runId: string,
  node: FlowNode,
  status: FlowRunStepStatus,
  extra: { leadsEntrada?: number; leadsSaida?: number; detalhe?: Json; erro?: string } = {},
) {
  const { data: existente } = await sb
    .from("flow_run_steps")
    .select("id")
    .eq("run_id", runId)
    .eq("node_id", node.id)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    status,
    leads_entrada: extra.leadsEntrada ?? null,
    leads_saida: extra.leadsSaida ?? null,
    detalhe: extra.detalhe ?? null,
    erro: extra.erro ?? null,
  };
  if (status === "concluido" || status === "erro" || status === "pulado") payload.concluido_em = new Date().toISOString();

  if (existente) {
    await sb.from("flow_run_steps").update(payload).eq("id", existente.id);
  } else {
    await sb.from("flow_run_steps").insert({
      run_id: runId, node_id: node.id, tipo: node.tipo, iniciado_em: new Date().toISOString(), ...payload,
    });
  }
}

// Backoff entre tentativas — não distingue erro passageiro (timeout,
// fornecedor fora do ar um instante) de permanente (chave não configurada,
// fluxo apagado): todo erro entra nesse mesmo ciclo até `max_tentativas`
// (padrão 3). Ver comentário de topo de 0016_flow_run_retry.sql pro porquê
// dessa simplificação deliberada.
const RETRY_BACKOFF_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000];

/** Erro num nó: agenda retry (mesmo nó, mesmo contexto) se ainda houver tentativas, senão marca a run como terminal. */
async function tratarErro(sb: SupabaseClient, run: FlowRunRow, mensagem: string) {
  const erro = String(mensagem).slice(0, 500);
  const tentativas = run.tentativas + 1;

  if (tentativas < run.max_tentativas) {
    const delay = RETRY_BACKOFF_MS[Math.min(tentativas - 1, RETRY_BACKOFF_MS.length - 1)];
    await sb.from("flow_runs").update({
      status: "aguardando_retry",
      tentativas,
      erro,
      proxima_tentativa_em: new Date(Date.now() + delay).toISOString(),
    }).eq("id", run.id);
    return;
  }

  await sb.from("flow_runs").update({
    status: "erro", erro, tentativas, concluido_em: new Date().toISOString(),
  }).eq("id", run.id);
}

async function avancarRun(sb: SupabaseClient, run: FlowRunRow, log: (m: string) => void) {
  if (!run.no_atual_id) {
    await sb.from("flow_runs").update({ status: "concluido", concluido_em: new Date().toISOString() }).eq("id", run.id);
    return;
  }

  const { data: flowRow } = await sb.from("automation_flows").select("*").eq("id", run.flow_id).single();
  const flow = flowRow as AutomationFlowRow | null;
  if (!flow) return tratarErro(sb, run, "Fluxo não encontrado (pode ter sido excluído).");

  const node = flow.nodes.find((n) => n.id === run.no_atual_id);
  if (!node) return tratarErro(sb, run, "Nó não encontrado — o fluxo pode ter sido editado depois desta execução começar.");

  const executor = FLOW_NODE_EXECUTORS[node.tipo];
  if (!executor) return tratarErro(sb, run, `Tipo de nó sem executor: ${node.tipo}`);

  const contexto = (run.contexto || {}) as FlowContexto;

  // Nó que trabalha em cima do lote (enriquecimento, filtro, espera,
  // disparo, destino) recebendo lote vazio — normal num fluxo agendado com
  // "só leads novos" num dia sem novidade — é pulado em vez de dar erro.
  // Antes, o enriquecimento acusava "nenhum lead com CNPJ", a run entrava
  // em retry 3 vezes e terminava como erro sem nada de errado ter acontecido.
  const consomeLote = ["enriquecimento", "controle", "disparo", "destino"].includes(FLOW_NODE_TYPES[node.tipo]?.categoria ?? "");
  if (consomeLote && !contexto.lote?.length) {
    await upsertStep(sb, run.id, node, "pulado", { leadsEntrada: 0, leadsSaida: 0, detalhe: { motivo: "Nenhum lead chegou neste passo." } });
    const proximoId = proximoNo(flow, node.id);
    await sb.from("flow_runs").update(
      proximoId
        ? { status: "executando", no_atual_id: proximoId }
        : { status: "concluido", concluido_em: new Date().toISOString() },
    ).eq("id", run.id);
    return;
  }

  await upsertStep(sb, run.id, node, "executando");
  // Interpola {{variaveis.x}}/{{lead.campo}} na config ANTES de passar pro
  // executor — nenhum executor precisa saber que isso existe, eles sempre
  // recebem valores já resolvidos.
  const noResolvido: FlowNode = {
    ...node,
    config: interpolarConfig((node.config || {}) as Record<string, unknown>, {
      variaveis: (contexto.variaveis as Record<string, string>) || {},
      lote: contexto.lote || [],
    }) as Json,
  };
  const outcome = await executor({
    sb, userId: run.user_id, node: noResolvido, contexto, log: (m) => log(`run ${run.id} nó ${node.id}: ${m}`),
    flowId: flow.id, runId: run.id, saidasConectadas: saidasConectadas(flow, node.id),
  });

  if (outcome.status === "erro") {
    await upsertStep(sb, run.id, node, "erro", { erro: outcome.erro, detalhe: outcome.detalhe });
    await tratarErro(sb, run, outcome.erro);
    return;
  }

  if (outcome.status === "aguardando_subprocesso") {
    await upsertStep(sb, run.id, node, "executando", { detalhe: outcome.detalhe });
    const novoContexto = { ...contexto, ...(outcome.contextoPatch || {}) };
    await sb.from("flow_runs").update({ status: "aguardando_subprocesso", contexto: novoContexto as Json }).eq("id", run.id);
    return;
  }

  // Saídas extras entregues na hora viram ramos. O detalhe do passo guarda
  // quantos leads saíram por cada uma (a contagem aparece no cartão do nó).
  const ramos: Record<string, number> = {};
  for (const [saida, loteSaida] of Object.entries(outcome.saidas ?? {})) {
    if (!loteSaida.length) continue;
    ramos[saida] = loteSaida.length;
    await abrirRamo(sb, flow, node.id, saida, loteSaida, {
      runPaiId: run.id, variaveis: (contexto.variaveis as Record<string, string>) || undefined,
    });
  }
  const detalhe = Object.keys(ramos).length && outcome.detalhe && typeof outcome.detalhe === "object" && !Array.isArray(outcome.detalhe)
    ? ({ ...outcome.detalhe, ramos } as Json)
    : outcome.detalhe;

  await upsertStep(sb, run.id, node, "concluido", {
    leadsEntrada: outcome.leadsEntrada, leadsSaida: outcome.leadsSaida, detalhe,
  });
  const novoContexto = { ...contexto, ...(outcome.contextoPatch || {}) };
  const proximoId = proximoNo(flow, node.id);
  if (proximoId) {
    await sb.from("flow_runs").update({ status: "executando", no_atual_id: proximoId, contexto: novoContexto as Json }).eq("id", run.id);
  } else {
    await sb.from("flow_runs").update({
      status: "concluido", contexto: novoContexto as Json, concluido_em: new Date().toISOString(),
    }).eq("id", run.id);
  }
}

/**
 * Retry manual (botão "Tentar novamente" numa run com status 'erro') — só
 * faz sentido numa run já terminal (as em `aguardando_retry` já estão no
 * ciclo automático). Reseta `tentativas` pra 0 (novo orçamento de retry
 * automático a partir daqui) e volta pra 'executando' no MESMO nó/contexto
 * de quando falhou — o próximo tick do worker já reexecuta.
 */
export async function reexecutarRun(sb: SupabaseClient, runId: string): Promise<boolean> {
  const { data, error } = await sb
    .from("flow_runs")
    .update({ status: "executando", tentativas: 0, erro: null, proxima_tentativa_em: null, concluido_em: null })
    .eq("id", runId)
    .eq("status", "erro")
    .select("id")
    .maybeSingle();
  return !error && Boolean(data);
}

/** Avança cada `flow_runs` ativa em 1 nó. */
export async function avancarRuns(sb: SupabaseClient, log: (m: string) => void): Promise<void> {
  const agora = new Date().toISOString();
  // Pega as runs em andamento de sempre + as que estão esperando retry cujo
  // horário já chegou — avancarRun() reexecuta o mesmo no_atual_id com o
  // mesmo contexto, então isso É o retry (não precisa de um caminho à parte).
  const { data } = await sb
    .from("flow_runs")
    .select("*")
    .or(`status.in.(executando,aguardando_subprocesso),and(status.eq.aguardando_retry,proxima_tentativa_em.lte.${agora})`);
  const runs = (data as FlowRunRow[]) || [];

  for (const run of runs) {
    try {
      await avancarRun(sb, run, log);
    } catch (e) {
      log(`Run ${run.id}: erro fatal: ${(e as Error).message}`);
      await tratarErro(sb, run, (e as Error).message);
    }
  }
}
