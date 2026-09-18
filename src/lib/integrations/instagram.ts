import { emptyLead, type Lead, type InstagramTipo } from "@/lib/types";

// Extração de leads via Instagram — integração com Apify. Portado de
// modules/instagram.py.

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_FOLLOWERS_FOLLOWING = "scraping_solutions~instagram-scraper-followers-following-no-cookies";
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

function normalizarPerfil(item: Record<string, unknown>, tipo: string): Lead | null {
  const userObj = (item.user as Record<string, unknown>) || {};
  const src = Object.keys(userObj).length ? userObj : item;

  const instaId = String(src.id ?? src.pk ?? src.pk_id ?? item.ownerUserId ?? item.owner_id ?? "").trim();
  const username = String(src.username ?? item.ownerUsername ?? item.owner_username ?? "").trim().replace(/^@/, "");

  if (!username && !instaId) return null;

  const lead = emptyLead();
  lead.instagram_id = instaId;
  lead.username = username ? `@${username}` : "";
  lead.nome = username ? `@${username}` : instaId;
  lead.nome_completo = String(src.full_name ?? item.ownerFullName ?? "").trim();
  lead.bio = String(src.biography ?? item.bio ?? "").trim().slice(0, 500);
  lead.followers_count = Number(src.followers_count ?? src.followersCount ?? 0);
  lead.is_business = Boolean(src.is_business_account ?? src.isBusinessAccount ?? false);
  lead.comentario = tipo === "comentaristas" ? String(item.text ?? "").slice(0, 300) : "";
  lead.site = String(src.external_url ?? src.website ?? "").trim();
  lead.email = String(src.public_email ?? src.email ?? "").trim();
  lead.maps_url = username ? `https://www.instagram.com/${username}/` : "";
  lead.nicho_busca = "Instagram";
  lead.subnicho_busca = tipo === "seguindo" ? "Following" : "Seguidor";
  lead.fonte = "instagram";
  return lead;
}

export interface BuscarInstagramParams {
  apifyApiKey: string;
  tipo: InstagramTipo;
  alvo: string;
  limite?: number;
  onProgress?: (a: number, t: number, msg: string) => void;
  excludeIds?: Set<string>;
}

export async function buscarInstagram(p: BuscarInstagramParams): Promise<Lead[]> {
  if (!p.apifyApiKey) {
    throw new Error("Chave Apify não configurada. Acesse Configurações → Instagram.");
  }

  const limite = p.limite ?? 200;
  const alvo = p.alvo.trim().replace(/^@/, "");
  const cb = p.onProgress ?? (() => {});

  cb(0, 1, "Preparando extração…");

  if (p.tipo !== "seguidores" && p.tipo !== "seguindo") {
    throw new Error(`Tipo inválido: ${p.tipo}. Use 'seguidores' ou 'seguindo'.`);
  }

  const username = alvo.startsWith("http") ? alvo.replace(/\/$/, "").split("/").pop() || "" : alvo;
  const inputData = {
    Account: [username],
    resultsLimit: limite,
    dataToScrape: p.tipo === "seguidores" ? "Followers" : "Following",
  };

  cb(0, 1, "Iniciando job no Apify…");
  const { runId, datasetId } = await iniciarRun(p.apifyApiKey, ACTOR_FOLLOWERS_FOLLOWING, inputData);
  await aguardarRun(p.apifyApiKey, runId, p.onProgress);

  cb(0, 1, "Baixando resultados…");
  const rawItems = await obterItems(p.apifyApiKey, datasetId, limite * 3);

  if (!rawItems.length) {
    throw new Error("O Apify retornou 0 itens. Verifique se o perfil é público.");
  }

  const vistos = new Set(p.excludeIds ?? []);
  let ignorados = 0;
  const resultados: Lead[] = [];

  for (const item of rawItems) {
    if (resultados.length >= limite) break;
    const lead = normalizarPerfil(item, p.tipo);
    if (!lead) continue;
    const dedupKey = lead.instagram_id || lead.username;
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
    throw new Error(`Apify retornou ${rawItems.length} itens mas nenhum pôde ser normalizado.`);
  }

  cb(1, 1, ignorados ? `${resultados.length} novos leads (${ignorados} duplicatas ignoradas)` : `${resultados.length} leads extraídos`);
  return resultados;
}
