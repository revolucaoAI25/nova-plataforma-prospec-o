import { apenasDigitos } from "@/lib/phone";
import { emptyLead, type Lead } from "@/lib/types";
import { MODIFICADORES_CIDADE, MODIFICADORES_ESTADO, shuffle } from "@/lib/integrations/google-maps";

// Busca via Apify Google Maps Scraper (compass/crawler-google-places).
// Fallback quando a cota do Google Maps API é excedida ou quando não há
// chave do Google Maps configurada. Portado de modules/apify_maps.py.

const ACTOR_ID = "compass~crawler-google-places";
const BASE = "https://api.apify.com/v2";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function iniciarRun(token: string, payload: Record<string, unknown>) {
  const resp = await fetch(`${BASE}/acts/${ACTOR_ID}/runs?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const body = (await resp.text()).slice(0, 300);
    if (resp.status === 401) throw new Error("Token Apify inválido. Verifique a chave em Configurações.");
    throw new Error(`Apify retornou ${resp.status}: ${body}`);
  }
  const data = (await resp.json()).data;
  return { runId: data.id as string, datasetId: data.defaultDatasetId as string };
}

async function aguardarRun(token: string, runId: string, timeoutMs: number, log: (a: number, t: number, m: string) => void) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resp = await fetch(`${BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
    if (!resp.ok) throw new Error(`Apify HTTP ${resp.status}`);
    const status = (await resp.json()).data.status as string;
    if (status === "SUCCEEDED") return;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      throw new Error(`Run Apify encerrado com status: ${status}`);
    }
    log(0, 1, `[Apify] Aguardando… (${status})`);
    await sleep(5000);
  }
  throw new Error("Timeout aguardando resultado do Apify (>10 min).");
}

async function buscarItems(token: string, datasetId: string): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ token, format: "json", clean: "true" });
  const resp = await fetch(`${BASE}/datasets/${datasetId}/items?${params}`);
  if (!resp.ok) throw new Error(`Apify HTTP ${resp.status}`);
  return await resp.json();
}

function montarVariacoes(queryBase: string, subnicho: string, cidade: string): string[] {
  const query = subnicho ? `${queryBase} ${subnicho}`.trim() : queryBase;
  const mods = cidade ? [...MODIFICADORES_CIDADE] : [...MODIFICADORES_ESTADO];
  const resto = shuffle(mods.slice(1));
  const escolhidos = [mods[0], ...resto].slice(0, 3);
  return escolhidos.map((m) => (m ? `${query} ${m}`.trim() : query));
}

interface BuscarUmaLocalidadeParams {
  queryBase: string;
  localidade: string;
  limite: number;
  apiKey: string;
  nicho: string;
  subnicho: string;
  cidade: string;
  estado: string;
  log: (a: number, t: number, m: string) => void;
  excludePhones: Set<string>;
  showPhone: boolean;
  showRating: boolean;
}

async function buscarUmaLocalidade(p: BuscarUmaLocalidadeParams): Promise<Lead[]> {
  const searchStrings = montarVariacoes(p.queryBase, p.subnicho, p.cidade);
  const cotaPorVariacao = Math.max(1, Math.ceil(p.limite / searchStrings.length));
  p.log(0, p.limite, `[Apify] Iniciando busca: ${searchStrings.length} variações em ${p.localidade}…`);

  const payload = {
    searchStringsArray: searchStrings,
    locationQuery: p.localidade,
    maxCrawledPlacesPerSearch: cotaPorVariacao,
  };

  const { runId, datasetId } = await iniciarRun(p.apiKey, payload);
  p.log(0, p.limite, "[Apify] Run iniciado. Aguardando resultados…");
  await aguardarRun(p.apiKey, runId, 600_000, p.log);
  p.log(0, p.limite, "[Apify] Coletando resultados…");

  const items = await buscarItems(p.apiKey, datasetId);
  const resultados: Lead[] = [];

  for (const item of items) {
    if (resultados.length >= p.limite) break;

    const statusFunc = item.permanentlyClosed
      ? "CLOSED_PERMANENTLY"
      : item.temporarilyClosed
        ? "CLOSED_TEMPORARILY"
        : "OPERATIONAL";
    const tel = String(item.phone ?? "");
    const telI = String(item.phoneUnformatted ?? "");

    if (p.excludePhones.size && tel && p.excludePhones.has(apenasDigitos(tel))) continue;

    const lead = emptyLead();
    lead.nome = String(item.title ?? "");
    lead.telefone = p.showPhone ? tel : "";
    lead.telefone_internacional = p.showPhone ? telI : "";
    lead.endereco = String(item.address ?? "");
    lead.site = String(item.website ?? "");
    lead.maps_url = String(item.url ?? "");
    lead.avaliacao = p.showRating ? (item.totalScore as number | string) ?? "" : "";
    lead.total_avaliacoes = p.showRating ? (item.reviewsCount as number | string) ?? "" : "";
    lead.status_funcionamento = statusFunc;
    lead.nicho_busca = p.nicho;
    lead.subnicho_busca = p.subnicho;
    lead.cidade_busca = p.cidade;
    lead.estado_busca = p.estado;
    lead.fonte = "Apify Maps";
    resultados.push(lead);
    p.log(resultados.length, p.limite, `[Apify] ${resultados.length}/${p.limite}`);
  }

  p.log(resultados.length, p.limite, `[Apify] '${p.localidade}': ${resultados.length} resultados.`);
  return resultados;
}

export interface BuscarApifyMapsParams {
  queryBase: string;
  localidade: string | string[];
  limite?: number;
  apiKey: string;
  nicho?: string;
  subnicho?: string;
  cidade?: string;
  estado?: string;
  onProgress?: (a: number, t: number, m: string) => void;
  excludePhones?: Set<string>;
  showPhone?: boolean;
  showRating?: boolean;
}

export async function buscarApifyMaps(p: BuscarApifyMapsParams): Promise<Lead[]> {
  if (!p.apiKey) throw new Error("Chave de API do Apify não configurada.");

  const localidades = (Array.isArray(p.localidade) ? p.localidade : [p.localidade]).map((l) => l.trim()).filter(Boolean);
  if (!localidades.length) throw new Error("Informe ao menos uma cidade ou estado.");

  const limite = p.limite ?? 60;
  const log = p.onProgress ?? (() => {});
  const vistosTel = new Set(p.excludePhones ?? []);
  const resultados: Lead[] = [];
  const multiplas = localidades.length > 1;

  function localizar(loc: string): [string, string] {
    if (!multiplas && (p.cidade || p.estado)) return [p.cidade ?? "", p.estado ?? ""];
    if (loc.includes(",")) {
      const [a, b] = loc.split(",", 2).map((x) => x.trim());
      return [a, b];
    }
    return ["", loc];
  }

  async function buscarLoc(loc: string, cota: number) {
    if (cota <= 0) return;
    const [cidadeLoc, estadoLoc] = localizar(loc);
    const parcial = await buscarUmaLocalidade({
      queryBase: p.queryBase,
      localidade: loc,
      limite: cota,
      apiKey: p.apiKey,
      nicho: p.nicho ?? "",
      subnicho: p.subnicho ?? "",
      cidade: cidadeLoc,
      estado: estadoLoc,
      log,
      excludePhones: vistosTel,
      showPhone: p.showPhone ?? true,
      showRating: p.showRating ?? true,
    });
    for (const r of parcial) {
      const d = apenasDigitos(r.telefone);
      if (d) vistosTel.add(d);
    }
    resultados.push(...parcial);
  }

  if (multiplas) {
    const cotaBase = Math.max(1, Math.floor(limite / localidades.length));
    for (let i = 0; i < localidades.length; i++) {
      if (resultados.length >= limite) break;
      log(resultados.length, limite, `[Apify] [${i + 1}/${localidades.length}] Buscando em ${localidades[i]}…`);
      await buscarLoc(localidades[i], Math.min(cotaBase, limite - resultados.length));
    }
    for (const loc of localidades) {
      if (resultados.length >= limite) break;
      await buscarLoc(loc, limite - resultados.length);
    }
  } else {
    await buscarLoc(localidades[0], limite);
  }

  log(resultados.length, limite, `[Apify] Concluído: ${resultados.length} resultados.`);
  return resultados.slice(0, limite);
}
