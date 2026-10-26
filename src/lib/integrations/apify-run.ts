// Execução de atores do Apify (iniciar, esperar e cancelar), compartilhada
// pelas buscas de Google Maps, Instagram e LinkedIn.
//
// Dois cuidados que faltavam antes:
// - todo run nasce com um prazo próprio (`timeout`). Sem isso o Apify
//   usa o padrão do ator (até 7 dias), e um run que trava continua
//   ocupando a memória da conta e faz as buscas seguintes ficarem na fila;
// - quando a nossa espera estoura, o run é cancelado em vez de ficar
//   rodando sozinho.

import { registrarAlertaAdmin } from "@/lib/alertas-admin";

const APIFY_BASE = "https://api.apify.com/v2";

/** Erros de conta: o limite de uso do mês acabou ou o recurso foi desativado no plano. */
const LIMITE_DA_CONTA = /monthly|hard limit|usage limit|platform-feature-disabled|exceed.*(usage|limit)|not enough.*(credit|usage)/i;

const MSG_BUSCA_INDISPONIVEL = "A busca está temporariamente indisponível. Nossa equipe já foi avisada; tente novamente mais tarde.";

async function avisarAdminBuscaParada(status: number, detalhe: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  const chave = status === 401 ? "apify:chave" : "apify:limite";
  await registrarAlertaAdmin({
    chave: `${chave}:${hoje}`,
    nivel: "critico",
    titulo: status === 401 ? "Buscas paradas: chave do Apify inválida" : "Buscas paradas: limite do Apify atingido",
    mensagem:
      (status === 401
        ? "O Apify recusou a chave cadastrada em /admin (Apify → API Token). As buscas de Google Maps, Instagram e LinkedIn estão falhando."
        : "O Apify recusou uma busca por limite da conta: o uso do mês acabou. As buscas de Google Maps, Instagram e LinkedIn estão paradas até você assinar um plano no Apify ou o ciclo virar.") +
      ` Os clientes veem só "busca temporariamente indisponível" e não são cobrados. Resposta do Apify: ${detalhe.slice(0, 200) || status}`,
    link: "https://console.apify.com/billing",
  });
}

const STATUS_FALHA = ["FAILED", "ABORTED", "TIMED-OUT"];

export interface RunApify {
  runId: string;
  datasetId: string;
}

export async function iniciarRunApify(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
  timeoutSegundos: number,
): Promise<RunApify> {
  const params = new URLSearchParams({ token, timeout: String(timeoutSegundos) });
  const resp = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    let detalhe = "";
    try {
      const j = await resp.json();
      detalhe = j?.error ? `${j.error.type ?? ""} ${j.error.message ?? ""}`.trim() : JSON.stringify(j).slice(0, 300);
    } catch {
      detalhe = "";
    }
    console.error(`[apify] ${actorId} respondeu ${resp.status}: ${detalhe}`);
    // O cliente nunca vê o detalhe do fornecedor; problema de conta (chave,
    // limite do mês) vira aviso para o admin.
    // Memória cheia é passageiro (buscas demais ao mesmo tempo), não o limite do mês.
    if (/memory/i.test(detalhe)) throw new Error("Muitas buscas rodando ao mesmo tempo agora. Tente novamente em alguns minutos.");
    if (resp.status === 401 || resp.status === 403 || LIMITE_DA_CONTA.test(detalhe)) {
      await avisarAdminBuscaParada(resp.status, detalhe);
      throw new Error(MSG_BUSCA_INDISPONIVEL);
    }
    throw new Error("Não foi possível iniciar a busca agora. Tente novamente em instantes.");
  }
  const data = (await resp.json()).data;
  return { runId: data.id as string, datasetId: data.defaultDatasetId as string };
}

/** Cancela o run (melhor esforço: erros aqui não mudam o resultado da busca). */
export async function abortarRunApify(token: string, runId: string): Promise<void> {
  try {
    await fetch(`${APIFY_BASE}/actor-runs/${runId}/abort?token=${encodeURIComponent(token)}`, { method: "POST" });
  } catch {
    // ignora
  }
}

/**
 * Espera o run terminar usando a espera longa do próprio Apify
 * (`waitForFinish`), que responde assim que o run acaba em vez de a gente
 * ficar consultando de tempos em tempos. Se passar do prazo, cancela o run.
 */
export async function aguardarRunApify(
  token: string,
  runId: string,
  timeoutMs: number,
  onStatus?: (status: string, segundos: number) => void,
): Promise<void> {
  const inicio = Date.now();
  const deadline = inicio + timeoutMs;
  while (Date.now() < deadline) {
    const espera = Math.max(1, Math.min(60, Math.floor((deadline - Date.now()) / 1000)));
    const resp = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}&waitForFinish=${espera}`);
    if (!resp.ok) {
      await abortarRunApify(token, runId);
      throw new Error(`O provedor de busca retornou ${resp.status} ao consultar o andamento.`);
    }
    const status = (await resp.json()).data.status as string;
    onStatus?.(status, Math.round((Date.now() - inicio) / 1000));
    if (status === "SUCCEEDED") return;
    if (STATUS_FALHA.includes(status)) throw new Error(`A busca foi encerrada pelo provedor (${status}).`);
  }
  await abortarRunApify(token, runId);
  throw new Error(`A busca passou de ${Math.round(timeoutMs / 60000)} minutos e foi cancelada. Tente com menos resultados ou uma região menor.`);
}
