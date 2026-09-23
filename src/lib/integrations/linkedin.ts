import { emptyLead, type Lead } from "@/lib/types";

// Extração de leads via LinkedIn (busca por pessoas/decisores, estilo Sales
// Navigator) — integração com Apify, mesmo padrão de instagram.ts.
//
// INCERTEZA DOCUMENTADA (mesmo espírito da seção 5.4 do plano original sobre
// o CNAE secundário — sinalizar em vez de esconder): o acesso de rede desta
// sessão está bloqueado para apify.com e docs.harvestapi.io, então o schema
// de input/output abaixo NÃO foi verificado direto na documentação — foi
// reconstruído a partir de exemplos corroborados via busca (dois exemplos
// independentes concordando nos nomes searchQuery/currentJobTitles/
// locations/maxResults). O normalizador de perfil abaixo é defensivo
// (tenta várias variações de nome de campo por propriedade) exatamente por
// causa dessa incerteza — se o ator devolver nomes diferentes dos previstos
// aqui, ajustar só os `??` do normalizarPerfil, sem mexer no resto do fluxo.
// Validar com uma chave Apify real antes de liberar pra usuários.

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_PEOPLE_SEARCH = "harvestapi~linkedin-profile-search";
const RUN_TIMEOUT_MS = 420_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function iniciarRun(apiKey: string, actorId: string, inputData: Record<string, unknown>) {
  const resp = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inputData),
  });
  if (!resp.ok) {
    let detalhe = "";
    try {
      const j = await resp.json();
      detalhe = j?.error?.message || JSON.stringify(j).slice(0, 300);
    } catch {
      detalhe = (await resp.text()).slice(0, 300);
    }
    throw new Error(`Apify ${resp.status}: ${detalhe}`);
  }
  const data = (await resp.json()).data;
  return { runId: data.id as string, datasetId: data.defaultDatasetId as string };
}

async function aguardarRun(apiKey: string, runId: string, onProgress?: (a: number, t: number, msg: string) => void) {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  let tentativa = 0;
  while (Date.now() < deadline) {
    await sleep(Math.min(8000 + tentativa * 2000, 20000));
    tentativa += 1;
    const resp = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(apiKey)}`);
    if (!resp.ok) throw new Error(`Apify HTTP ${resp.status} consultando o run.`);
    const status = (await resp.json()).data.status as string;
    onProgress?.(0, 1, `Apify: ${status.toLowerCase()}… (${tentativa * 10}s)`);
    if (status === "SUCCEEDED") return;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      throw new Error(`Apify encerrou com status: ${status}`);
    }
  }
  throw new Error(`Apify não respondeu em ${RUN_TIMEOUT_MS / 1000}s. Tente com menos resultados.`);
}

async function obterItems(apiKey: string, datasetId: string, limite: number): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ token: apiKey, format: "json", limit: String(limite) });
  const resp = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?${params}`);
  if (!resp.ok) throw new Error(`Apify HTTP ${resp.status} baixando resultados.`);
  return (await resp.json()) || [];
}

/** Remove query string/trailing slash e força https — chave de dedup estável entre buscas. */
function normalizarUrlPerfil(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    u.protocol = "https:";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

function normalizarPerfil(item: Record<string, unknown>): Lead | null {
  const experiencia = Array.isArray(item.experience) ? (item.experience[0] as Record<string, unknown> | undefined) : undefined;
  const posicaoAtual = (item.currentPosition as Record<string, unknown> | undefined) ?? experiencia;

  const urlBruta = String(
    item.linkedinUrl ?? item.profileUrl ?? item.publicProfileUrl ?? item.url ?? "",
  ).trim();
  const linkedinUrl = normalizarUrlPerfil(urlBruta);

  const nome = String(item.name ?? item.fullName ?? item.publicIdentifier ?? "").trim();
  if (!nome && !linkedinUrl) return null;

  const lead = emptyLead();
  lead.linkedin_url = linkedinUrl;
  lead.nome = nome || linkedinUrl;
  lead.nome_completo = nome;
  lead.cargo = String(item.headline ?? item.currentJobTitle ?? item.title ?? posicaoAtual?.title ?? "").trim();
  lead.empresa_atual = String(
    item.currentCompany ?? item.company ?? posicaoAtual?.company ?? posicaoAtual?.companyName ?? "",
  ).trim();
  lead.senioridade = String(item.seniority ?? item.seniorityLevel ?? "").trim();
  lead.municipio = String(item.location ?? item.locationName ?? "").trim();
  lead.email = String(item.email ?? "").trim();
  lead.bio = String(item.about ?? item.summary ?? "").trim().slice(0, 500);
  lead.nicho_busca = "LinkedIn";
  lead.fonte = "linkedin";
  return lead;
}

export interface BuscarLinkedInParams {
  apifyApiKey: string;
  cargos: string[];
  localizacoes: string[];
  palavraChave?: string;
  limite?: number;
  onProgress?: (a: number, t: number, msg: string) => void;
  excludeUrls?: Set<string>;
}

export async function buscarLinkedIn(p: BuscarLinkedInParams): Promise<Lead[]> {
  if (!p.apifyApiKey) {
    throw new Error("Chave Apify não configurada. Acesse Configurações → Instagram (a mesma chave vale para LinkedIn).");
  }
  if (!p.cargos.length && !p.localizacoes.length && !p.palavraChave?.trim()) {
    throw new Error("Informe ao menos um cargo, localização ou palavra-chave.");
  }

  const limite = p.limite ?? 100;
  const cb = p.onProgress ?? (() => {});

  cb(0, 1, "Preparando extração…");

  const inputData: Record<string, unknown> = { maxResults: limite };
  if (p.cargos.length) inputData.currentJobTitles = p.cargos;
  if (p.localizacoes.length) inputData.locations = p.localizacoes;
  if (p.palavraChave?.trim()) inputData.searchQuery = p.palavraChave.trim();

  cb(0, 1, "Iniciando job no Apify…");
  const { runId, datasetId } = await iniciarRun(p.apifyApiKey, ACTOR_PEOPLE_SEARCH, inputData);
  await aguardarRun(p.apifyApiKey, runId, p.onProgress);

  cb(0, 1, "Baixando resultados…");
  const rawItems = await obterItems(p.apifyApiKey, datasetId, limite * 2);

  if (!rawItems.length) {
    throw new Error("O Apify retornou 0 itens. Tente cargos/localizações mais amplos.");
  }

  const vistos = new Set(p.excludeUrls ?? []);
  let ignorados = 0;
  const resultados: Lead[] = [];

  for (const item of rawItems) {
    if (resultados.length >= limite) break;
    const lead = normalizarPerfil(item);
    if (!lead) continue;
    const dedupKey = lead.linkedin_url || lead.nome;
    if (dedupKey && vistos.has(dedupKey)) {
      ignorados += 1;
      continue;
    }
    if (dedupKey) vistos.add(dedupKey);
    resultados.push(lead);
  }

  if (rawItems.length && !resultados.length) {
    const first = rawItems[0];
    if ("message" in first && Object.keys(first).length <= 3) {
      throw new Error(`O actor retornou um erro: ${first.message}`);
    }
    throw new Error(`Apify retornou ${rawItems.length} itens mas nenhum pôde ser normalizado — o schema do ator pode ter mudado (ver comentário no topo deste arquivo).`);
  }

  cb(1, 1, ignorados ? `${resultados.length} novos leads (${ignorados} duplicatas ignoradas)` : `${resultados.length} leads extraídos`);
  return resultados;
}
