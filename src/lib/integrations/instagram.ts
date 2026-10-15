import { emptyLead, type Lead, type InstagramTipo } from "@/lib/types";
import { aguardarRunApify, iniciarRunApify } from "@/lib/integrations/apify-run";

// Extração de leads via Instagram — integração com Apify. Portado de
// modules/instagram.py.

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_FOLLOWERS_FOLLOWING = "scraping_solutions~instagram-scraper-followers-following-no-cookies";
const RUN_TIMEOUT_MS = 420_000;

// Run, espera e cancelamento ficam em apify-run.ts (prazo próprio por run e
// cancelamento quando a espera estoura).
function iniciarRun(apiKey: string, actorId: string, inputData: Record<string, unknown>) {
  return iniciarRunApify(apiKey, actorId, inputData, Math.ceil(RUN_TIMEOUT_MS / 1000) - 20);
}

function aguardarRun(apiKey: string, runId: string, onProgress?: (a: number, t: number, msg: string) => void) {
  return aguardarRunApify(apiKey, runId, RUN_TIMEOUT_MS, (status, seg) => onProgress?.(0, 1, `Buscando: ${status.toLowerCase()}… (${seg}s)`));
}

async function obterItems(apiKey: string, datasetId: string, limite: number): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ token: apiKey, format: "json", limit: String(limite) });
  const resp = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?${params}`);
  if (!resp.ok) throw new Error(`Falha ${resp.status} ao baixar os resultados da busca.`);
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
  lead.fonte = "Instagram";
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
    throw new Error("Busca no Instagram indisponível no momento (chave da plataforma não configurada).");
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

  cb(0, 1, "Iniciando a busca…");
  const { runId, datasetId } = await iniciarRun(p.apifyApiKey, ACTOR_FOLLOWERS_FOLLOWING, inputData);
  await aguardarRun(p.apifyApiKey, runId, p.onProgress);

  cb(0, 1, "Baixando resultados…");
  const rawItems = await obterItems(p.apifyApiKey, datasetId, limite * 3);

  if (!rawItems.length) {
    throw new Error("A busca não trouxe nenhum perfil. Verifique se o perfil é público.");
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
    throw new Error(`A busca trouxe ${rawItems.length} itens, mas nenhum pôde ser lido. Tente de novo mais tarde.`);
  }

  cb(1, 1, ignorados ? `${resultados.length} novos leads (${ignorados} duplicatas ignoradas)` : `${resultados.length} leads extraídos`);
  return resultados;
}
