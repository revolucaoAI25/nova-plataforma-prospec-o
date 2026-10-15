import { MUNICIPIOS } from "@/lib/data/municipios";

/**
 * "Incluir cidades vizinhas" da busca por CNPJ: a base de CNPJ não aceita
 * raio, então o raio vira uma lista de municípios cuja sede fica a até X km
 * da sede da cidade escolhida (coordenadas do IBGE). A busca continua exata
 * por município — só passa a cobrir mais municípios.
 */

export const RAIO_VIZINHOS_MAX_KM = 60;

const normalizar = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export interface MunicipioVizinho {
  nome: string;
  uf: string;
  distanciaKm: number;
}

/** Município da base pelo nome, preferindo os estados informados (há nomes repetidos, como Santo André/SP e /PB). */
function acharMunicipio(nome: string, ufs: string[]) {
  const alvo = normalizar(nome);
  const candidatos = MUNICIPIOS.filter(([n]) => normalizar(n) === alvo);
  const ufsMai = ufs.map((u) => u.toUpperCase());
  return candidatos.find(([, uf]) => ufsMai.includes(uf)) ?? (ufsMai.length ? undefined : candidatos[0]);
}

/** Cidades a até `km` de cada cidade escolhida, sem as próprias, da mais perto para a mais longe. */
export function cidadesVizinhas(cidades: string[], ufs: string[], km: number): { vizinhas: MunicipioVizinho[]; naoEncontradas: string[] } {
  const raio = Math.min(Math.max(km, 0), RAIO_VIZINHOS_MAX_KM);
  const naoEncontradas: string[] = [];
  const centros = cidades.flatMap((c) => {
    const m = acharMunicipio(c, ufs);
    if (!m) naoEncontradas.push(c);
    return m ? [m] : [];
  });
  if (!raio || !centros.length) return { vizinhas: [], naoEncontradas };

  const escolhidas = new Set(centros.map(([n, uf]) => `${n}|${uf}`));
  const melhor = new Map<string, MunicipioVizinho>();
  for (const [nome, uf, lat, lng] of MUNICIPIOS) {
    const chave = `${nome}|${uf}`;
    if (escolhidas.has(chave)) continue;
    for (const [, , cLat, cLng] of centros) {
      const d = distanciaKm(cLat, cLng, lat, lng);
      if (d <= raio && (!melhor.has(chave) || melhor.get(chave)!.distanciaKm > d)) {
        melhor.set(chave, { nome, uf, distanciaKm: Math.round(d) });
      }
    }
  }
  return { vizinhas: [...melhor.values()].sort((a, b) => a.distanciaKm - b.distanciaKm), naoEncontradas };
}

/**
 * Filtro de localização final da busca: cidades escolhidas + vizinhas, e os
 * estados de todas elas (uma vizinha pode ficar do outro lado da divisa).
 */
export function expandirComVizinhas(cidades: string[], ufs: string[], km: number) {
  const { vizinhas, naoEncontradas } = cidadesVizinhas(cidades, ufs, km);
  return {
    municipios: [...cidades, ...vizinhas.map((v) => v.nome)],
    ufs: Array.from(new Set([...ufs.map((u) => u.toUpperCase()), ...vizinhas.map((v) => v.uf)])),
    vizinhas,
    naoEncontradas,
  };
}

/**
 * Localização final de uma busca por CNPJ (avulsa ou no fluxo): estados e
 * municípios a mandar para a base, o texto para o Histórico e um aviso
 * quando alguma cidade digitada não foi achada para calcular as vizinhas.
 */
export function localizacaoCnpj(ufs: string[], municipios: string[], raioKm: number) {
  if (!raioKm || !municipios.length) {
    return { ufs, municipios, descricao: municipios.length ? municipios.join(", ") : ufs.join(", "), aviso: null as string | null };
  }
  const r = expandirComVizinhas(municipios, ufs, raioKm);
  const descricao = `${municipios.join(", ")} + ${r.vizinhas.length} cidade(s) a até ${raioKm} km`;
  const aviso = r.naoEncontradas.length
    ? `Não achamos ${r.naoEncontradas.join(", ")} na lista de municípios para calcular as vizinhas — confira a grafia.`
    : null;
  return { ufs: r.ufs, municipios: r.municipios, descricao, aviso };
}
