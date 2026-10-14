import type { SupabaseClient } from "@supabase/supabase-js";
import { configPlataforma } from "@/lib/platform-settings";

/**
 * Endereço → coordenada, para o mapa dos resultados.
 *
 * Dois provedores, com cache compartilhado na tabela `geocodificacoes` (o
 * mesmo endereço, bairro ou cidade nunca é consultado duas vezes):
 * - Google Geocoding, quando a chave do Google Maps da plataforma está
 *   configurada (a mesma da verificação de CNPJ; a Geocoding API precisa
 *   estar ativada no projeto). Rápido e preciso; US$ 5 a cada 1.000 consultas
 *   além da cota gratuita mensal do Google, e o cache segura a repetição.
 * - Photon (geocodificador aberto do OpenStreetMap), sem chave e sem custo,
 *   como reserva. O serviço público é lento (vários segundos por consulta) e
 *   pede uso moderado; GEOCODER_URL aponta para uma instância própria.
 *
 * Tentativas, da mais precisa para a menos: endereço completo (precisão de
 * rua), bairro + cidade e, por fim, o centro da cidade. Resultado que cai
 * em outra cidade é descartado: endereço da Receita costuma vir com
 * abreviações e complemento, e às vezes aparece uma rua de mesmo nome em
 * outro lugar.
 */

export type PrecisaoGeo = "rua" | "bairro" | "cidade" | "nao_encontrado";

export interface EnderecoLead {
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
}

export interface Coordenada {
  latitude: number | null;
  longitude: number | null;
  precisao: PrecisaoGeo;
}

const BASE = (process.env.GEOCODER_URL || "https://photon.komoot.io").replace(/\/$/, "");
const TIMEOUT_MS = 15_000;
const GOOGLE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

const normalizar = (t: string | null | undefined) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface FeaturePhoton {
  geometry?: { coordinates?: [number, number] };
  properties?: { city?: string; county?: string; district?: string; locality?: string; name?: string; state?: string; type?: string };
}

async function consultarPhoton(q: string, municipio: string, extras: Record<string, string> = {}): Promise<[number, number] | null> {
  const params = new URLSearchParams({ q, limit: "4", ...extras });
  try {
    const resp = await fetch(`${BASE}/api/?${params}`, {
      headers: { "User-Agent": "Leadmatic/1.0 (mapa de resultados)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { features?: FeaturePhoton[] };
    return naCidade(json.features ?? [], municipio);
  } catch {
    return null;
  }
}

/** Primeiro resultado que fica na cidade esperada (o Photon devolve a cidade em campos diferentes conforme o lugar). */
function naCidade(features: FeaturePhoton[], municipio: string): [number, number] | null {
  const alvo = normalizar(municipio);
  for (const f of features) {
    const p = f.properties ?? {};
    const cidades = [p.city, p.county, p.locality, p.district, p.type === "city" ? p.name : undefined].map(normalizar);
    const coords = f.geometry?.coordinates;
    if (coords && (!alvo || cidades.includes(alvo))) return coords;
  }
  return null;
}

interface ResultadoGoogle {
  geometry?: { location?: { lat: number; lng: number } };
  address_components?: { long_name: string; types: string[] }[];
}

// Chave recusada (ex.: Geocoding API desativada no projeto): para de tentar
// o Google por um tempo e segue só com o Photon.
let googleIndisponivelAte = 0;

/** null = não achou na cidade; undefined = Google indisponível (cai no Photon). */
async function consultarGoogle(q: string, municipio: string, uf: string): Promise<[number, number] | null | undefined> {
  if (Date.now() < googleIndisponivelAte) return undefined;
  const chave = await configPlataforma("google_maps_api_key", process.env.GOOGLE_MAPS_API_KEY).catch(() => "");
  if (!chave) return undefined;
  const params = new URLSearchParams({
    address: q, key: chave, region: "br", language: "pt-BR",
    components: `country:BR${uf ? `|administrative_area:${uf}` : ""}`,
  });
  try {
    const resp = await fetch(`${GOOGLE_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = (await resp.json()) as { status: string; results?: ResultadoGoogle[] };
    if (json.status === "ZERO_RESULTS") return null;
    if (json.status !== "OK") {
      googleIndisponivelAte = Date.now() + 10 * 60_000;
      return undefined;
    }
    const alvo = normalizar(municipio);
    for (const r of json.results ?? []) {
      const cidades = (r.address_components ?? [])
        .filter((c) => c.types.includes("administrative_area_level_2") || c.types.includes("locality"))
        .map((c) => normalizar(c.long_name));
      const loc = r.geometry?.location;
      if (loc && (!alvo || cidades.includes(alvo))) return [loc.lng, loc.lat];
    }
    return null;
  } catch {
    return undefined;
  }
}

async function doCache(sb: SupabaseClient, chave: string): Promise<Coordenada | null> {
  const { data } = await sb.from("geocodificacoes").select("latitude, longitude, precisao").eq("chave", chave).maybeSingle();
  return data ? { latitude: data.latitude, longitude: data.longitude, precisao: data.precisao as PrecisaoGeo } : null;
}

async function guardar(sb: SupabaseClient, chave: string, c: Coordenada) {
  await sb.from("geocodificacoes").upsert({ chave, latitude: c.latitude, longitude: c.longitude, precisao: c.precisao });
}

/** Tenta uma consulta (com cache). Devolve null quando não achou nada na cidade. */
async function tentativa(
  sb: SupabaseClient, chave: string, q: string, municipio: string, uf: string, precisao: PrecisaoGeo, extrasPhoton?: Record<string, string>,
): Promise<Coordenada | null> {
  const cache = await doCache(sb, chave);
  if (cache) return cache.precisao === "nao_encontrado" ? null : cache;
  const google = await consultarGoogle(q, municipio, uf);
  const coords = google === undefined ? await consultarPhoton(q, municipio, extrasPhoton) : google;
  const c: Coordenada = coords ? { longitude: coords[0], latitude: coords[1], precisao } : { latitude: null, longitude: null, precisao: "nao_encontrado" };
  await guardar(sb, chave, c);
  return coords ? c : null;
}

/** `sb` precisa poder ler e gravar `geocodificacoes` (cliente de serviço). */
export async function geocodificar(sb: SupabaseClient, e: EnderecoLead): Promise<Coordenada> {
  const municipio = (e.municipio ?? "").trim();
  const uf = (e.uf ?? "").trim().toUpperCase();
  if (!municipio) return { latitude: null, longitude: null, precisao: "nao_encontrado" };
  const local = `${municipio}${uf ? `, ${uf}` : ""}, Brasil`;

  if (e.endereco?.trim()) {
    const q = `${e.endereco.trim()}, ${local}`;
    const r = await tentativa(sb, `end:${normalizar(q)}`, q, municipio, uf, "rua");
    if (r) return r;
  }
  if (e.bairro?.trim()) {
    const q = `${e.bairro.trim()}, ${local}`;
    const r = await tentativa(sb, `bairro:${normalizar(q)}`, q, municipio, uf, "bairro");
    if (r) return r;
  }
  const r = await tentativa(sb, `cidade:${normalizar(local)}`, local, municipio, uf, "cidade", { osm_tag: "place" });
  return r ?? { latitude: null, longitude: null, precisao: "nao_encontrado" };
}

/** Roda `fn` em `itens` com no máximo `n` ao mesmo tempo. */
export async function emParalelo<T, R>(itens: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, itens.length) }, async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        saida[i] = await fn(itens[i]);
      }
    }),
  );
  return saida;
}
