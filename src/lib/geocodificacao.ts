import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Endereço → coordenada, para o mapa dos resultados.
 *
 * Usa o Photon (geocodificador aberto em cima do OpenStreetMap), sem chave e
 * sem custo, com cache compartilhado na tabela `geocodificacoes`: o mesmo
 * endereço, bairro ou cidade nunca é consultado duas vezes. O serviço
 * público é lento (alguns segundos por consulta) e pede uso moderado; com
 * volume alto, GEOCODER_URL aponta para uma instância própria do Photon.
 * Google Geocoding foi descartado de propósito: custo por consulta.
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

async function doCache(sb: SupabaseClient, chave: string): Promise<Coordenada | null> {
  const { data } = await sb.from("geocodificacoes").select("latitude, longitude, precisao").eq("chave", chave).maybeSingle();
  return data ? { latitude: data.latitude, longitude: data.longitude, precisao: data.precisao as PrecisaoGeo } : null;
}

async function guardar(sb: SupabaseClient, chave: string, c: Coordenada) {
  await sb.from("geocodificacoes").upsert({ chave, latitude: c.latitude, longitude: c.longitude, precisao: c.precisao });
}

/** Tenta uma consulta (com cache). Devolve null quando não achou nada na cidade. */
async function tentativa(
  sb: SupabaseClient, chave: string, q: string, municipio: string, precisao: PrecisaoGeo, extrasPhoton?: Record<string, string>,
): Promise<Coordenada | null> {
  const cache = await doCache(sb, chave);
  if (cache) return cache.precisao === "nao_encontrado" ? null : cache;
  const coords = await consultarPhoton(q, municipio, extrasPhoton);
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
    const r = await tentativa(sb, `end:${normalizar(q)}`, q, municipio, "rua");
    if (r) return r;
  }
  if (e.bairro?.trim()) {
    const q = `${e.bairro.trim()}, ${local}`;
    const r = await tentativa(sb, `bairro:${normalizar(q)}`, q, municipio, "bairro");
    if (r) return r;
  }
  const r = await tentativa(sb, `cidade:${normalizar(local)}`, local, municipio, "cidade", { osm_tag: "place" });
  return r ?? { latitude: null, longitude: null, precisao: "nao_encontrado" };
}
