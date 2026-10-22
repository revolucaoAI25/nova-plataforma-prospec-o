import { apenasDigitos } from "@/lib/phone";
import { emptyLead, type Lead } from "@/lib/types";
import { MODIFICADORES_CIDADE, MODIFICADORES_ESTADO, shuffle } from "@/lib/integrations/google-maps";
import { aguardarRunApify, iniciarRunApify } from "@/lib/integrations/apify-run";

// Busca via Apify Google Maps Scraper (compass/crawler-google-places).
// Fallback quando a cota do Google Maps API é excedida ou quando não há
// chave do Google Maps configurada. Portado de modules/apify_maps.py.

const ACTOR_ID = "compass~crawler-google-places";
const BASE = "https://api.apify.com/v2";
// Prazo de cada run no Apify e da nossa espera (a espera é um pouco maior
// para receber o status final do próprio Apify).
const RUN_TIMEOUT_S = 540;
const ESPERA_MS = 560_000;

async function buscarItems(token: string, datasetId: string): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ token, format: "json", clean: "true" });
  const resp = await fetch(`${BASE}/datasets/${datasetId}/items?${params}`);
  if (!resp.ok) throw new Error(`Falha ${resp.status} ao baixar os resultados da busca no Maps.`);
  return await resp.json();
}

function montarVariacoes(queryBase: string, subnicho: string, cidade: string): string[] {
  const query = subnicho ? `${queryBase} ${subnicho}`.trim() : queryBase;
  const mods = cidade ? [...MODIFICADORES_CIDADE] : [...MODIFICADORES_ESTADO];
  const resto = shuffle(mods.slice(1));
  const escolhidos = [mods[0], ...resto].slice(0, 3);
  return escolhidos.map((m) => (m ? `${query} ${m}`.trim() : query));
}

/** Círculo da busca por raio: o extrator varre só essa área (sem cidade/estado). */
export interface RaioBusca {
  lat: number;
  lng: number;
  km: number;
}

interface BuscarUmaLocalidadeParams {
  raio?: RaioBusca;
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
  // No raio a área já está definida: variações como "zona norte" não fazem
  // sentido, vai só o termo (o extrator divide o círculo em partes sozinho).
  const searchStrings = p.raio
    ? [p.subnicho ? `${p.queryBase} ${p.subnicho}`.trim() : p.queryBase]
    : montarVariacoes(p.queryBase, p.subnicho, p.cidade);
  const cotaPorVariacao = Math.max(1, Math.ceil(p.limite / searchStrings.length));
  p.log(0, p.limite, `Iniciando busca: ${searchStrings.length} variações em ${p.localidade}…`);

  const payload = {
    searchStringsArray: searchStrings,
    ...(p.raio
      ? { customGeolocation: { type: "Point", coordinates: [p.raio.lng, p.raio.lat], radiusKm: p.raio.km } }
      : { locationQuery: p.localidade }),
    maxCrawledPlacesPerSearch: cotaPorVariacao,
    // País e idioma explícitos: a localização ("Cidade, Estado") é resolvida
    // direto no Brasil, sem ambiguidade, e os dados voltam em português.
    countryCode: "br",
    language: "pt-BR",
  };

  const { runId, datasetId } = await iniciarRunApify(p.apiKey, ACTOR_ID, payload, RUN_TIMEOUT_S);
  p.log(0, p.limite, "Run iniciado. Aguardando resultados…");
  await aguardarRunApify(p.apiKey, runId, ESPERA_MS, (status, seg) => p.log(0, 1, `Aguardando… (${status}, ${seg}s)`));
  p.log(0, p.limite, "Coletando resultados…");

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
    lead.fonte = "Maps";
    const local = item.location as { lat?: unknown; lng?: unknown } | undefined;
    if (typeof local?.lat === "number" && typeof local?.lng === "number") {
      lead.latitude = local.lat;
      lead.longitude = local.lng;
    }
    if (typeof item.neighborhood === "string") lead.bairro = item.neighborhood;
    if (typeof item.city === "string" && !lead.municipio) lead.municipio = item.city;
    resultados.push(lead);
    p.log(resultados.length, p.limite, `${resultados.length}/${p.limite}`);
  }

  p.log(resultados.length, p.limite, `'${p.localidade}': ${resultados.length} resultados.`);
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
  /** Busca num círculo em vez de cidade/estado; `localidade` vira só o rótulo. */
  raio?: RaioBusca;
}

export async function buscarApifyMaps(p: BuscarApifyMapsParams): Promise<Lead[]> {
  if (!p.apiKey) throw new Error("Busca no Maps indisponível no momento (chave da plataforma não configurada).");

  const localidades = (Array.isArray(p.localidade) ? p.localidade : [p.localidade]).map((l) => l.trim()).filter(Boolean);
  if (!localidades.length) throw new Error("Informe ao menos uma cidade ou estado.");

  const limite = p.limite ?? 60;
  const log = p.onProgress ?? (() => {});
  const vistosTel = new Set(p.excludePhones ?? []);
  const resultados: Lead[] = [];
  const multiplas = !p.raio && localidades.length > 1;

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
      raio: p.raio,
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
      log(resultados.length, limite, `[${i + 1}/${localidades.length}] Buscando em ${localidades[i]}…`);
      await buscarLoc(localidades[i], Math.min(cotaBase, limite - resultados.length));
    }
    for (const loc of localidades) {
      if (resultados.length >= limite) break;
      await buscarLoc(loc, limite - resultados.length);
    }
  } else {
    await buscarLoc(localidades[0], limite);
  }

  log(resultados.length, limite, `Concluído: ${resultados.length} resultados.`);
  return resultados.slice(0, limite);
}

// ── Verificação de empresas já conhecidas (busca por CNPJ e "Enriquecimento via Maps")

export interface PerfilMaps {
  telefone: string;
  site: string;
  mapsUrl: string;
  avaliacao: number | null;
  totalAvaliacoes: number;
  latitude: number | null;
  longitude: number | null;
  bairro: string;
}

const VERIFICACAO_RUN_TIMEOUT_S = 540;
const VERIFICACAO_ESPERA_MS = 560_000;

/**
 * Procura cada consulta ("nome cidade UF") no Maps e devolve o primeiro
 * perfil de cada uma. Tudo numa execução só: o ator responde por
 * `searchString`, que é como cada perfil volta para a consulta que o achou.
 * Consulta sem resultado não aparece no mapa devolvido.
 */
export async function perfisMapsApify(apiKey: string, consultas: string[]): Promise<Map<string, PerfilMaps>> {
  const unicas = [...new Set(consultas.map((c) => c.trim()).filter(Boolean))];
  const perfis = new Map<string, PerfilMaps>();
  if (!unicas.length) return perfis;

  const payload = {
    searchStringsArray: unicas,
    maxCrawledPlacesPerSearch: 1,
    countryCode: "br",
    language: "pt-BR",
  };
  const { runId, datasetId } = await iniciarRunApify(apiKey, ACTOR_ID, payload, VERIFICACAO_RUN_TIMEOUT_S);
  await aguardarRunApify(apiKey, runId, VERIFICACAO_ESPERA_MS);
  const items = await buscarItems(apiKey, datasetId);

  for (const item of items) {
    const consulta = String(item.searchString ?? "").trim();
    if (!consulta || perfis.has(consulta)) continue;
    const local = item.location as { lat?: unknown; lng?: unknown } | undefined;
    const nota = Number(item.totalScore);
    perfis.set(consulta, {
      telefone: String(item.phone ?? ""),
      site: String(item.website ?? ""),
      mapsUrl: String(item.url ?? ""),
      avaliacao: Number.isFinite(nota) && item.totalScore != null ? nota : null,
      totalAvaliacoes: Number(item.reviewsCount ?? 0) || 0,
      latitude: typeof local?.lat === "number" ? local.lat : null,
      longitude: typeof local?.lng === "number" ? local.lng : null,
      bairro: typeof item.neighborhood === "string" ? item.neighborhood : "",
    });
  }
  return perfis;
}
