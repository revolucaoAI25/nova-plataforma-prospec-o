// Execução de atores do Apify (iniciar, esperar e cancelar), compartilhada
// pelas buscas de Google Maps, Instagram e LinkedIn.
//
// Dois cuidados que faltavam antes:
// - todo run nasce com um prazo próprio (`timeout`). Sem isso o Apify
//   usa o padrão do ator (até 7 dias), e um run que trava continua
//   ocupando a memória da conta e faz as buscas seguintes ficarem na fila;
// - quando a nossa espera estoura, o run é cancelado em vez de ficar
//   rodando sozinho.

const APIFY_BASE = "https://api.apify.com/v2";
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
      detalhe = j?.error?.message || JSON.stringify(j).slice(0, 300);
    } catch {
      detalhe = "";
    }
    if (resp.status === 401) throw new Error("Chave do provedor de busca inválida. Avise o suporte.");
    throw new Error(`O provedor de busca retornou ${resp.status}${detalhe ? `: ${detalhe}` : ""}`);
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
