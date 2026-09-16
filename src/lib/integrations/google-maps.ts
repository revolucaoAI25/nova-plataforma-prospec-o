import { apenasDigitos } from "@/lib/phone";
import { emptyLead, type Lead } from "@/lib/types";

// Integração com o Google Maps Places API — endpoint LEGADO
// (deliberadamente, por decisão do usuário nesta reconstrução: replicar
// o comportamento já validado do produto atual antes de migrar para o
// endpoint novo v1/places:searchText. Ver seção 5.4 do plano — o legado
// foi congelado pelo Google em março/2025, sem novos projetos, então
// essa migração deve ser revisitada antes de abrir contas novas).
//
// Custo por SKU: Text Search (Pro, ~5.000 grátis/mês), Place Details
// (Pro, ~5.000 grátis/mês), Contact Data — telefone/site — (Enterprise,
// ~1.000 grátis/mês). rating/user_ratings_total vêm do Text Search
// (Essentials, nunca cobrado aqui).

const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const DETAIL_FIELDS =
  "name,formatted_phone_number,international_phone_number,formatted_address,website,url,business_status";

export class QuotaExceededError extends Error {}
export class MapsAccessError extends Error {}

export const MODIFICADORES_CIDADE = [
  "", "centro", "zona norte", "zona sul", "zona leste", "zona oeste",
  "região central", "região metropolitana", "bairros", "periferia",
  "centro histórico", "arredores",
];

export const MODIFICADORES_ESTADO = [
  "", "capital", "interior", "litoral", "região metropolitana", "norte", "sul",
];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PlaceCandidate {
  place_id: string;
  nome: string;
  endereco: string;
  avaliacao: number | "";
  total_avaliacoes: number | "";
  status_funcionamento: string;
}

async function textSearch(query: string, apiKey: string, pageToken?: string) {
  const params = pageToken
    ? new URLSearchParams({ pagetoken: pageToken, key: apiKey })
    : new URLSearchParams({ query, language: "pt-BR", key: apiKey });
  const resp = await fetch(`${TEXT_SEARCH_URL}?${params.toString()}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} na Places Text Search`);
  return resp.json();
}

async function getDetails(placeId: string, apiKey: string) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: DETAIL_FIELDS,
    language: "pt-BR",
    key: apiKey,
  });
  const resp = await fetch(`${DETAILS_URL}?${params.toString()}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} na Places Details`);
  const json = await resp.json();
  return json.result || {};
}

export interface Stats {
  text_search_calls: number;
  contact_data_calls: number;
}

async function coletarPlacesUmaQuery(
  query: string,
  apiKey: string,
  log: (a: number, t: number, m: string) => void,
  stats: Stats,
): Promise<PlaceCandidate[]> {
  const places: PlaceCandidate[] = [];
  let pageToken: string | undefined;
  let paginas = 0;

  while (paginas < 3) {
    stats.text_search_calls += 1;
    let data;
    try {
      data = await textSearch(query, apiKey, pageToken);
    } catch (e) {
      log(0, 0, `Erro na busca: ${(e as Error).message}`);
      break;
    }

    const status = data.status;
    if (status === "ZERO_RESULTS") break;
    if (status === "REQUEST_DENIED") {
      throw new MapsAccessError(
        `API negou o acesso: ${data.error_message || ""}. Verifique se a chave está correta e se a Places API está ativada.`,
      );
    }
    if (status === "OVER_QUERY_LIMIT") {
      throw new QuotaExceededError("Cota diária da API Google Maps esgotada.");
    }
    if (status === "INVALID_REQUEST") break;
    if (status !== "OK") {
      throw new Error(`Erro da API: ${status} — ${data.error_message || ""}`);
    }

    for (const place of data.results || []) {
      places.push({
        place_id: place.place_id,
        nome: place.name || "",
        endereco: place.formatted_address || "",
        avaliacao: place.rating ?? "",
        total_avaliacoes: place.user_ratings_total ?? "",
        status_funcionamento: place.business_status || "",
      });
    }

    pageToken = data.next_page_token;
    paginas += 1;
    if (!pageToken) break;
    await sleep(2000);
  }

  return places;
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
  stats: Stats;
}

async function buscarUmaLocalidade(p: BuscarUmaLocalidadeParams): Promise<Lead[]> {
  const nichoQuery = p.subnicho ? `${p.queryBase} ${p.subnicho.toLowerCase()}`.trim() : p.queryBase;

  const modificadores = p.cidade ? MODIFICADORES_CIDADE : MODIFICADORES_ESTADO;
  const mods =
    modificadores[0] === "" ? ["", ...shuffle(modificadores.slice(1))] : shuffle(modificadores);

  p.log(0, p.limite, `Coletando resultados para: ${nichoQuery} em ${p.localidade}`);

  const resultados: Lead[] = [];
  let pulados = 0;
  const vistosPid = new Set<string>();

  for (const mod of mods) {
    if (resultados.length >= p.limite) break;

    const query = mod ? `${nichoQuery} em ${mod} de ${p.localidade}` : `${nichoQuery} em ${p.localidade}`;
    p.log(resultados.length, p.limite, `Buscando: ${query}`);
    const placesMod = await coletarPlacesUmaQuery(query, p.apiKey, p.log, p.stats);

    for (const place of placesMod) {
      if (resultados.length >= p.limite) break;

      const pid = place.place_id;
      if (vistosPid.has(pid)) continue;
      vistosPid.add(pid);

      let telefone = "";
      let telInt = "";
      let site = "";
      let endereco = place.endereco;
      let mapsUrl = `https://www.google.com/maps/place/?q=place_id:${pid}`;

      if (p.showPhone) {
        try {
          const det = await getDetails(pid, p.apiKey);
          telefone = det.formatted_phone_number || "";
          telInt = det.international_phone_number || "";
          site = det.website || "";
          mapsUrl = det.url || mapsUrl;
          endereco = det.formatted_address || endereco;
        } catch {
          // segue sem detalhes — erro pontual não derruba a busca inteira
        }
      }

      if (p.excludePhones.size && telefone && p.excludePhones.has(apenasDigitos(telefone))) {
        pulados += 1;
        p.log(
          resultados.length,
          p.limite,
          `${p.showPhone ? "Detalhes" : "Resultados"}: ${resultados.length}/${p.limite} (pulados ${pulados} repetidos)`,
        );
        if (p.showPhone) await sleep(100);
        continue;
      }

      const lead = emptyLead();
      lead.nome = place.nome;
      lead.telefone = telefone;
      lead.telefone_internacional = telInt;
      lead.endereco = endereco;
      lead.site = site;
      lead.maps_url = mapsUrl;
      lead.avaliacao = p.showRating ? place.avaliacao : "";
      lead.total_avaliacoes = p.showRating ? place.total_avaliacoes : "";
      lead.status_funcionamento = place.status_funcionamento;
      lead.nicho_busca = p.nicho;
      lead.subnicho_busca = p.subnicho;
      lead.cidade_busca = p.cidade;
      lead.estado_busca = p.estado;
      lead.fonte = "Google Maps";
      resultados.push(lead);

      p.log(resultados.length, p.limite, `${p.showPhone ? "Detalhes" : "Resultados"}: ${resultados.length}/${p.limite}`);
      if (p.showPhone) await sleep(100);
    }
  }

  const sufixo = pulados ? ` (${pulados} repetidos ignorados)` : "";
  p.log(resultados.length, p.limite, `'${p.localidade}': ${resultados.length} resultados${sufixo}.`);
  return resultados;
}

export interface BuscarMapsParams {
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
  stats?: Stats;
}

export async function buscarMaps(p: BuscarMapsParams): Promise<Lead[]> {
  if (!p.apiKey) {
    throw new MapsAccessError("Chave da API do Google Maps não encontrada.");
  }

  const localidades = (Array.isArray(p.localidade) ? p.localidade : [p.localidade])
    .map((l) => l.trim())
    .filter(Boolean);
  if (!localidades.length) throw new Error("Informe ao menos uma cidade ou estado.");

  const limite = p.limite ?? 60;
  const log = p.onProgress ?? (() => {});
  const stats = p.stats ?? { text_search_calls: 0, contact_data_calls: 0 };
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
      stats,
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

  const sufixo = multiplas ? ` (${localidades.length} localidades)` : "";
  log(resultados.length, limite, `Concluído: ${resultados.length} resultados${sufixo}.`);
  return resultados.slice(0, limite);
}

export interface EnriquecerComMapsParams {
  resultados: Lead[];
  apiKey: string;
  onProgress?: (i: number, total: number, msg: string) => void;
  showPhone?: boolean;
  showRating?: boolean;
  stats?: Stats;
  filtrar?: boolean;
  minAvaliacoes?: number;
}

/**
 * Enriquece cada lead com dados do Google Maps (telefone/site/avaliação) e,
 * opcionalmente, filtra quem não tem perfil no Maps (ou tem menos que o
 * mínimo de avaliações). Cobrança/uso é contado por empresa VERIFICADA, não
 * pelo que sobra depois do filtro — a chamada já foi feita mesmo assim.
 * Falha de rede pontual numa empresa não a remove (fail-open).
 */
export async function enriquecerComMaps(p: EnriquecerComMapsParams): Promise<Lead[]> {
  const { resultados, apiKey } = p;
  const filtrar = p.filtrar ?? false;
  const showPhone = p.showPhone ?? true;
  const showRating = p.showRating ?? true;
  const minAvaliacoes = p.minAvaliacoes ?? 0;
  const stats = p.stats ?? { text_search_calls: 0, contact_data_calls: 0 };
  const total = resultados.length;
  const mantidos: Lead[] = [];

  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];
    const nome = (r.nome || "").trim();
    const municipio = (r.municipio || r.cidade_busca || "").trim();
    const uf = (r.uf || r.estado_busca || "").trim();

    p.onProgress?.(i, total, `[${i + 1}/${total}] ${nome.slice(0, 45)}…`);

    if (!nome) {
      mantidos.push(r);
      continue;
    }

    const query = `${nome} ${municipio} ${uf}`.trim();
    stats.text_search_calls += 1;
    let resp;
    try {
      resp = await textSearch(query, apiKey);
    } catch {
      mantidos.push(r);
      continue;
    }

    const status = resp.status;
    if (status === "REQUEST_DENIED") {
      throw new MapsAccessError(
        `API negou o acesso: ${resp.error_message || ""}. Verifique se a chave está correta e se a Places API está ativada.`,
      );
    }
    if (status === "OVER_QUERY_LIMIT") {
      throw new QuotaExceededError("Cota diária da API Google Maps esgotada.");
    }

    const encontrado = status === "OK" && Boolean(resp.results?.length);
    let nAvaliacoes = 0;
    let jaCobradoCaro = false;

    // Sem confirmação de que rating/user_ratings_total é campo gratuito no
    // endpoint legado (indícios de que a API nova reclassifica pra
    // Enterprise) — quando o filtro EXIGE mínimo de avaliações reais,
    // conta como uso "caro" por segurança (mesmo proxy do Contact Data).
    if (filtrar && minAvaliacoes > 0) {
      stats.contact_data_calls += 1;
      jaCobradoCaro = true;
    }

    if (encontrado) {
      const place = resp.results[0];
      const pid = place.place_id || "";
      nAvaliacoes = Number(place.user_ratings_total || 0);

      if (showRating) {
        if (place.rating != null) r.avaliacao = place.rating;
        if (place.user_ratings_total != null) r.total_avaliacoes = place.user_ratings_total;
      }
      if (pid && !r.maps_url) r.maps_url = `https://www.google.com/maps/place/?q=place_id:${pid}`;

      if (pid && showPhone) {
        if (!jaCobradoCaro) stats.contact_data_calls += 1;
        try {
          const det = await getDetails(pid, apiKey);
          if (det.url) r.maps_url = det.url;
          const tel = det.formatted_phone_number || det.international_phone_number || "";
          if (tel) {
            if (!r.telefone) r.telefone = tel;
            else if (apenasDigitos(r.telefone) !== apenasDigitos(tel) && !r.telefone2) r.telefone2 = tel;
          }
          if (det.website && !r.site) r.site = det.website;
        } catch {
          // Place Details falhou — mantém o que já tem do Text Search
        }
      }
    }

    if (filtrar) {
      if (encontrado && nAvaliacoes >= minAvaliacoes) mantidos.push(r);
    } else {
      mantidos.push(r);
    }

    await sleep(50);
  }

  p.onProgress?.(total, total, "Concluído!");
  return mantidos;
}
