import { apenasDigitos } from "@/lib/phone";
import { chaveApify, chaveGoogleMaps } from "@/lib/platform-keys";
import { enriquecerComMaps } from "@/lib/integrations/google-maps";
import { perfisMapsApify, type PerfilMaps } from "@/lib/integrations/apify-maps";
import type { Lead } from "@/lib/types";

/**
 * Verificação de empresas no Google Maps (busca por CNPJ, "Extração CNPJ" e
 * "Enriquecimento via Maps"). O extrator é sempre a primeira opção; a API do
 * Google só entra quando o extrator falha num pedaço do lote (e só se a
 * chave dela estiver configurada).
 */

// Empresas por execução do extrator e execuções ao mesmo tempo.
const POR_EXECUCAO = 200;
const EXECUCOES_SIMULTANEAS = 3;

export class MapsIndisponivelError extends Error {}

export interface VerificarNoMapsParams {
  resultados: Lead[];
  showPhone: boolean;
  showRating?: boolean;
  filtrar: boolean;
  minAvaliacoes: number;
}

export async function verificacaoMapsDisponivel(): Promise<boolean> {
  const [apify, google] = await Promise.all([chaveApify(), chaveGoogleMaps()]);
  return Boolean(apify || google);
}

export const consultaMaps = (r: Lead) =>
  `${(r.nome || "").trim()} ${(r.municipio || r.cidade_busca || "").trim()} ${(r.uf || r.estado_busca || "").trim()}`.trim();

/** Mesmas regras de preenchimento e filtro da verificação pela API do Google. */
function aplicarPerfis(lote: Lead[], perfis: Map<string, PerfilMaps>, p: VerificarNoMapsParams): Lead[] {
  const showRating = p.showRating ?? true;
  const mantidos: Lead[] = [];
  for (const r of lote) {
    if (!(r.nome || "").trim()) {
      mantidos.push(r);
      continue;
    }
    const perfil = perfis.get(consultaMaps(r));
    if (perfil) {
      if (showRating) {
        if (perfil.avaliacao != null) r.avaliacao = perfil.avaliacao;
        r.total_avaliacoes = perfil.totalAvaliacoes;
      }
      if (perfil.mapsUrl) r.maps_url = perfil.mapsUrl;
      if (p.showPhone && perfil.telefone) {
        if (!r.telefone) r.telefone = perfil.telefone;
        else if (apenasDigitos(r.telefone) !== apenasDigitos(perfil.telefone) && !r.telefone2) r.telefone2 = perfil.telefone;
      }
      if (p.showPhone && perfil.site && !r.site) r.site = perfil.site;
      if (r.latitude == null && perfil.latitude != null) {
        r.latitude = perfil.latitude;
        r.longitude = perfil.longitude;
      }
      if (!r.bairro && perfil.bairro) r.bairro = perfil.bairro;
    }
    if (!p.filtrar || (perfil && perfil.totalAvaliacoes >= p.minAvaliacoes)) mantidos.push(r);
  }
  return mantidos;
}

/**
 * Verifica o lote todo. Erros da API do Google (cota, acesso negado) sobem
 * como antes; se não houver nenhum caminho disponível para um pedaço do
 * lote, lança MapsIndisponivelError.
 */
export async function verificarNoMaps(p: VerificarNoMapsParams): Promise<Lead[]> {
  const [apify, google] = await Promise.all([chaveApify(), chaveGoogleMaps()]);
  if (!apify && !google) throw new MapsIndisponivelError("A verificação no Google Maps está indisponível no momento.");

  const pedacos: Lead[][] = [];
  for (let i = 0; i < p.resultados.length; i += POR_EXECUCAO) pedacos.push(p.resultados.slice(i, i + POR_EXECUCAO));
  const saida: Lead[][] = new Array(pedacos.length);

  const verificarPedaco = async (lote: Lead[]): Promise<Lead[]> => {
    if (apify) {
      try {
        const perfis = await perfisMapsApify(apify, lote.map(consultaMaps));
        return aplicarPerfis(lote, perfis, p);
      } catch (e) {
        if (!google) throw new MapsIndisponivelError(`A verificação no Google Maps falhou: ${(e as Error).message}`);
      }
    }
    return enriquecerComMaps({ resultados: lote, apiKey: google, showPhone: p.showPhone, showRating: p.showRating, filtrar: p.filtrar, minAvaliacoes: p.minAvaliacoes });
  };

  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < pedacos.length) {
      const i = proximo++;
      saida[i] = await verificarPedaco(pedacos[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EXECUCOES_SIMULTANEAS, pedacos.length) }, trabalhador));
  return saida.flat();
}
