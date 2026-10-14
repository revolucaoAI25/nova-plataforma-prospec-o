import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationFlowRow } from "@/lib/database.types";
import { abrirRamo, proximoNo } from "./flow-engine";

/**
 * Saídas por resultado dos nós de disparo ("Enviou", "Falhou", "Respondeu",
 * "Sem resposta").
 *
 * O disparo não acontece dentro do fluxo: o nó só inscreve os leads na
 * campanha e a fila de envio de cada canal trabalha no ritmo dela, às vezes
 * por dias. Por isso essas saídas não seguem na mesma execução. Quando o nó
 * tem alguma delas ligada, cada alvo inscrito guarda de qual fluxo/nó veio
 * (`flow_id`, `flow_node_id`) e esta varredura, chamada pelo worker junto
 * com o motor de fluxos, olha o andamento dos alvos e abre uma execução de
 * ramo com os leads de cada saída.
 *
 * Os leads de uma mesma saída são juntados num lote só: o lote sai quando o
 * evento mais antigo dele completa JANELA_MS. Sem isso, um disparo de 40
 * mensagens por dia abriria 40 execuções de uma pessoa cada.
 */

const JANELA_MS = 30 * 60_000;
const INTERVALO_VARREDURA_MS = 60_000;
const MAX_ALVOS_POR_CANAL = 5000;
// Cadência concluída ainda pode receber resposta atrasada: o alvo fica em
// observação por esse tempo antes de sair da varredura.
const OBSERVAR_CONCLUIDO_MS = 30 * 86_400_000;
// Alvo que nunca chega a um fim (ex.: convite do LinkedIn nunca aceito).
const ABANDONAR_APOS_MS = 120 * 86_400_000;

const CANAIS = [
  { tabela: "dispatch_targets", contato: "telefone" },
  { tabela: "email_targets", contato: "email" },
  { tabela: "linkedin_targets", contato: "linkedin_url" },
] as const;

type Canal = (typeof CANAIS)[number];

interface AlvoComOrigem {
  id: string;
  flow_id: string;
  flow_node_id: string;
  flow_run_id: string | null;
  flow_saidas: string[] | null;
  status: string;
  primeiro_envio_em: string | null;
  respondido_em: string | null;
  atualizado_em: string;
  criado_em: string;
  lead_snapshot: unknown;
  [contato: string]: unknown;
}

// ── Varredura (worker) ───────────────────────────────────────────────

interface Evento {
  saida: string;
  em: number;
}

function horasSemResposta(flow: AutomationFlowRow, nodeId: string): number {
  const config = flow.nodes.find((n) => n.id === nodeId)?.config as { horasSemResposta?: unknown } | undefined;
  const h = Number(config?.horasSemResposta);
  return Number.isFinite(h) && h > 0 ? h : 48;
}

function eventosDoAlvo(alvo: AlvoComOrigem, horasSemResp: number, agora: number): Evento[] {
  const ja = new Set(alvo.flow_saidas ?? []);
  const eventos: Evento[] = [];
  const t = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);
  const atualizado = t(alvo.atualizado_em);

  if (alvo.primeiro_envio_em && !ja.has("enviou")) eventos.push({ saida: "enviou", em: t(alvo.primeiro_envio_em) });
  if (alvo.status === "falhou" && !alvo.primeiro_envio_em && !ja.has("falhou")) eventos.push({ saida: "falhou", em: atualizado });
  if (alvo.status === "respondeu" && !ja.has("respondeu")) eventos.push({ saida: "respondeu", em: t(alvo.respondido_em) || atualizado });

  // "Sem resposta": a cadência terminou (ou parou por erro depois do 1º
  // envio) e passou o prazo sem resposta.
  const cadenciaAcabou = alvo.status === "concluido" || (alvo.status === "falhou" && Boolean(alvo.primeiro_envio_em));
  const prazo = atualizado + horasSemResp * 3_600_000;
  if (cadenciaAcabou && !ja.has("sem_resposta") && !ja.has("respondeu") && prazo <= agora) {
    eventos.push({ saida: "sem_resposta", em: prazo });
  }
  return eventos;
}

/** Depois de entregar os eventos, o alvo ainda pode gerar algum? Se não, sai da varredura. */
function encerrado(alvo: AlvoComOrigem, saidas: Set<string>, horasSemResp: number, agora: number): boolean {
  if (agora - new Date(alvo.criado_em).getTime() > ABANDONAR_APOS_MS) return true;
  // Ainda tem evento esperando o lote dele sair.
  if (eventosDoAlvo({ ...alvo, flow_saidas: [...saidas] }, horasSemResp, agora).length) return false;
  switch (alvo.status) {
    case "removido":
    case "respondeu":
      return true;
    case "falhou":
      // Falhou depois do 1º envio: ainda falta o prazo do "Sem resposta".
      return alvo.primeiro_envio_em ? saidas.has("sem_resposta") : true;
    case "concluido":
      return agora - new Date(alvo.atualizado_em).getTime() > OBSERVAR_CONCLUIDO_MS;
    default:
      return false;
  }
}

function leadDoAlvo(alvo: AlvoComOrigem, canal: Canal, saida: string): Record<string, unknown> {
  const snap = alvo.lead_snapshot && typeof alvo.lead_snapshot === "object" && !Array.isArray(alvo.lead_snapshot)
    ? (alvo.lead_snapshot as Record<string, unknown>)
    : {};
  const lead: Record<string, unknown> = { ...snap, resultado_disparo: saida };
  if (saida === "falhou") {
    lead.contato_que_falhou = String(snap[canal.contato] ?? alvo[canal.contato] ?? "");
    lead.motivo_falha = "O envio deu erro";
  }
  return lead;
}

let ultimaVarredura = 0;

/** Abre os ramos das saídas por resultado com o que aconteceu nas campanhas desde a última varredura. */
export async function rotearSaidasDeDisparo(sb: SupabaseClient, log: (m: string) => void): Promise<void> {
  const agora = Date.now();
  if (agora - ultimaVarredura < INTERVALO_VARREDURA_MS) return;
  ultimaVarredura = agora;

  // Fluxo pausado não recebe ramos: os eventos ficam guardados e saem
  // quando ele for ativado de novo.
  const { data: flowsData } = await sb.from("automation_flows").select("*").eq("ativo", true);
  const flows = new Map(((flowsData as AutomationFlowRow[]) || []).map((f) => [f.id, f]));
  if (!flows.size) return;
  const flowIds = [...flows.keys()];

  for (const canal of CANAIS) {
    try {
      await rotearCanal(sb, canal, flows, flowIds, agora, log);
    } catch (e) {
      log(`Saídas de disparo (${canal.tabela}): ${(e as Error).message}`);
    }
  }
}

async function rotearCanal(
  sb: SupabaseClient,
  canal: Canal,
  flows: Map<string, AutomationFlowRow>,
  flowIds: string[],
  agora: number,
  log: (m: string) => void,
) {
  const alvos: AlvoComOrigem[] = [];
  for (let i = 0; i < flowIds.length && alvos.length < MAX_ALVOS_POR_CANAL; i += 200) {
    const { data, error } = await sb
      .from(canal.tabela)
      .select(`id, flow_id, flow_node_id, flow_run_id, flow_saidas, status, primeiro_envio_em, respondido_em, atualizado_em, criado_em, lead_snapshot, ${canal.contato}`)
      .in("flow_id", flowIds.slice(i, i + 200))
      .is("flow_encerrado_em", null)
      .limit(MAX_ALVOS_POR_CANAL - alvos.length);
    if (error) throw new Error(error.message);
    alvos.push(...((data as unknown as AlvoComOrigem[]) || []));
  }
  if (!alvos.length) return;

  // Agrupa os eventos por fluxo + nó + saída. Evento de saída sem ligação é
  // só marcado como visto (nada a fazer com ele).
  interface Grupo { flow: AutomationFlowRow; nodeId: string; saida: string; maisAntigo: number; itens: AlvoComOrigem[] }
  const grupos = new Map<string, Grupo>();
  const novasSaidas = new Map<string, Set<string>>();
  const marcarJa = (alvo: AlvoComOrigem, saida: string) => {
    const set = novasSaidas.get(alvo.id) ?? new Set(alvo.flow_saidas ?? []);
    set.add(saida);
    novasSaidas.set(alvo.id, set);
  };

  for (const alvo of alvos) {
    const flow = flows.get(alvo.flow_id);
    if (!flow) continue;
    for (const ev of eventosDoAlvo(alvo, horasSemResposta(flow, alvo.flow_node_id), agora)) {
      if (!proximoNo(flow, alvo.flow_node_id, ev.saida)) {
        marcarJa(alvo, ev.saida);
        continue;
      }
      const chave = `${alvo.flow_id}|${alvo.flow_node_id}|${ev.saida}`;
      const g = grupos.get(chave) ?? { flow, nodeId: alvo.flow_node_id, saida: ev.saida, maisAntigo: ev.em, itens: [] };
      g.maisAntigo = Math.min(g.maisAntigo, Number.isFinite(ev.em) ? ev.em : agora);
      g.itens.push(alvo);
      grupos.set(chave, g);
    }
  }

  for (const g of grupos.values()) {
    if (agora - g.maisAntigo < JANELA_MS) continue;
    const lote = g.itens.map((alvo) => leadDoAlvo(alvo, canal, g.saida));
    const runPaiId = g.itens[0]?.flow_run_id ?? null;
    // Parâmetros do fluxo ({{variaveis.x}}) da execução que inscreveu esses leads.
    const { data: pai } = runPaiId ? await sb.from("flow_runs").select("contexto").eq("id", runPaiId).maybeSingle() : { data: null };
    const variaveis = (pai?.contexto as { variaveis?: Record<string, string> } | null)?.variaveis;
    const runId = await abrirRamo(sb, g.flow, g.nodeId, g.saida, lote, { runPaiId, variaveis });
    if (!runId) continue;
    for (const alvo of g.itens) marcarJa(alvo, g.saida);
    log(`Fluxo ${g.flow.id}: ${lote.length} lead(s) saíram por "${g.saida}" (execução ${runId}).`);
  }

  // Grava o que foi entregue e tira da varredura quem não tem mais nada a
  // gerar. Agrupado por valor final pra fazer poucas atualizações.
  const porValor = new Map<string, { saidas: string[]; encerrar: boolean; ids: string[] }>();
  for (const alvo of alvos) {
    if (!flows.has(alvo.flow_id)) continue;
    const saidas = novasSaidas.get(alvo.id) ?? new Set(alvo.flow_saidas ?? []);
    const fim = encerrado(alvo, saidas, horasSemResposta(flows.get(alvo.flow_id)!, alvo.flow_node_id), agora);
    const mudou = novasSaidas.has(alvo.id) || fim;
    if (!mudou) continue;
    const lista = [...saidas].sort();
    const chave = `${lista.join(",")}|${fim}`;
    const item = porValor.get(chave) ?? { saidas: lista, encerrar: fim, ids: [] };
    item.ids.push(alvo.id);
    porValor.set(chave, item);
  }
  for (const item of porValor.values()) {
    for (let i = 0; i < item.ids.length; i += 500) {
      await sb
        .from(canal.tabela)
        .update({ flow_saidas: item.saidas, ...(item.encerrar ? { flow_encerrado_em: new Date(agora).toISOString() } : {}) })
        .in("id", item.ids.slice(i, i + 500));
    }
  }
}
