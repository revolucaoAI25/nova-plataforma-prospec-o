import { getProfile, debitarCreditos } from "@/lib/credits";
import { resolverChaveMaps, resolverChaveMapsOverflow, registrarUsoChaveMaps } from "@/lib/maps-key";
import { buscarCnpj, removerDuplicadosLote, CasaDosDadosError, type BuscaTextual } from "@/lib/integrations/casa-dos-dados";
import { enriquecerComMaps, QuotaExceededError, MapsAccessError } from "@/lib/integrations/google-maps";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes } from "@/lib/db";
import { CODIGO_PARA_DESC } from "@/lib/data/cnaes";
import type { Json } from "@/lib/database.types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Espelha /api/search/cnpj/route.ts (mesmos filtros e mesma lógica de
 * enriquecimento/filtro por Google Maps embutido, `mapsModo`).
 */
export async function executarExtracaoCnpj(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;

  const cnaes = Array.isArray(config.cnaes) ? (config.cnaes as string[]) : [];
  const cnaeManual = String(config.cnaeManual || "").split(",").map((c) => c.trim()).filter(Boolean);
  const cnaesTodos = Array.from(new Set([...cnaes, ...cnaeManual]));
  const uf = Array.isArray(config.uf) ? (config.uf as string[]) : [];
  const municipio = Array.isArray(config.municipio) ? (config.municipio as string[]) : [];
  const porte = Array.isArray(config.porte) ? (config.porte as string[]) : [];
  const matrizFilial = (config.matrizFilial as "" | "MATRIZ" | "FILIAL") || "";
  const simples = (config.simplesOptante as "indiferente" | "apenas" | "excluir") || "indiferente";
  const mei = (config.meiOptante as "indiferente" | "apenas" | "excluir") || "indiferente";
  const tipoTelefone = (config.tipoTelefone as "todos" | "celular" | "fixo") || "todos";
  const recuperacaoJudicial = Boolean(config.recuperacaoJudicial);
  const apenasNovos = config.apenasNovos !== false;
  const mapsModo = (config.mapsModo as "nao_usar" | "enriquecer" | "filtrar" | "filtrar_enriquecer") || "nao_usar";
  const minAvaliacoes = Number(config.minAvaliacoes ?? 0);

  const profile = await getProfile(sb, userId);
  if (!profile) return { status: "erro", erro: "Perfil não encontrado." };
  if (profile.cdd_credits <= 0) return { status: "erro", erro: "Créditos de busca CNPJ insuficientes." };

  const cddApiKey = profile.cdd_api_key || profile.cdd_api_key_admin || process.env.CDD_API_KEY || "";
  if (!cddApiKey) return { status: "erro", erro: "Nenhuma chave da Casa dos Dados configurada." };

  let buscaTextual: BuscaTextual[] | null = null;
  let situacoesCadastrais: string[] | null = null;
  if (recuperacaoJudicial) {
    buscaTextual = [{ texto: ["recuperacao judicial"], tipo_busca: "exata", razao_social: true, nome_fantasia: true }];
    situacoesCadastrais = ["ATIVA", "SUSPENSA", "INAPTA"];
  }

  let excludeTels = new Set<string>();
  let excludeCnpjs = new Set<string>();
  if (apenasNovos) {
    const existentes = await buscarIdentificadoresExistentes(sb, userId);
    excludeTels = existentes.telefones;
    excludeCnpjs = existentes.cnpjs;
  }

  const limite = Math.min(Number(config.limite ?? 300), profile.cdd_credits);

  let resultados;
  try {
    resultados = await buscarCnpj({
      apiKey: cddApiKey,
      cnaes: cnaesTodos,
      uf,
      municipio,
      porte: porte.length ? porte : null,
      matrizFilial,
      simplesOptante: simples === "apenas" ? true : null,
      excluirSimples: simples === "excluir",
      meiOptante: mei === "apenas" ? true : null,
      excluirMei: mei === "excluir",
      comTelefone: config.comTelefone !== false,
      comEmail: Boolean(config.comEmail),
      somenteCelular: tipoTelefone === "celular",
      somenteFixo: tipoTelefone === "fixo",
      excluirEmailContab: config.excluirEmailContab !== false,
      dataAberturaInicio: String(config.dataAberturaInicio || ""),
      dataAberturaFim: String(config.dataAberturaFim || ""),
      capitalMin: (config.capitalMin as number | null) ?? null,
      capitalMax: (config.capitalMax as number | null) ?? null,
      limite,
      excludePhones: apenasNovos ? excludeTels : undefined,
      excludeCnpjs: apenasNovos ? excludeCnpjs : undefined,
      cnaeTipo: (config.cnaeTipo as "principal" | "secundario" | "ambos") || "principal",
      buscaTextual,
      situacoesCadastrais,
      dedupRaiz: recuperacaoJudicial,
    });
  } catch (e) {
    return { status: "erro", erro: e instanceof CasaDosDadosError ? e.message : (e as Error).message };
  }

  resultados = removerDuplicadosLote(
    resultados,
    apenasNovos ? new Set(excludeCnpjs) : new Set<string>(),
    apenasNovos ? new Set(excludeTels) : new Set<string>(),
  );

  let mapsVerificados = 0;
  if (mapsModo !== "nao_usar" && resultados.length > 0) {
    let resolucao = await resolverChaveMaps(profile);
    if (resolucao.bloqueado || !resolucao.key) {
      const overflow = await resolverChaveMapsOverflow(profile);
      if (overflow.key) resolucao = overflow;
    }
    if (resolucao.key && !resolucao.bloqueado) {
      const filtrar = mapsModo === "filtrar" || mapsModo === "filtrar_enriquecer";
      const enriquecer = mapsModo === "enriquecer" || mapsModo === "filtrar_enriquecer";
      const nVerificados = resultados.length;
      const stats = { text_search_calls: 0, contact_data_calls: 0 };
      try {
        resultados = await enriquecerComMaps({ resultados, apiKey: resolucao.key, showPhone: enriquecer, filtrar, minAvaliacoes, stats });
        mapsVerificados = nVerificados;
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          mapsVerificados = nVerificados;
        } else if (e instanceof MapsAccessError) {
          return { status: "erro", erro: e.message };
        } else {
          throw e;
        }
      }
      await registrarUsoChaveMaps(sb, userId, profile, resolucao, stats.contact_data_calls, stats.text_search_calls);
      resultados = removerDuplicadosLote(
        resultados,
        apenasNovos ? new Set(excludeCnpjs) : new Set<string>(),
        apenasNovos ? new Set(excludeTels) : new Set<string>(),
      );
    }
  }

  const total = resultados.length;
  const nichoLabel = cnaesTodos.length ? CODIGO_PARA_DESC[cnaesTodos[0]] || cnaesTodos[0] : "Recuperação Judicial";
  const searchId = await salvarPesquisa(sb, userId, {
    fonte: "cnpj",
    nicho: nichoLabel,
    subnicho: cnaesTodos.join(", "),
    cidade: municipio.join(", "),
    estado: uf.join(", "),
    localidade: municipio.length ? municipio.join(", ") : uf.join(", "),
    totalResults: total,
    filtros: config as Json,
  });
  if (searchId && total) await salvarLeads(sb, userId, searchId, resultados);

  await debitarCreditos(sb, userId, "cdd_credits", total);
  if (mapsVerificados > 0 && profile.maps_credits_enabled) {
    await debitarCreditos(sb, userId, "maps_credits", mapsVerificados);
  }

  return {
    status: "concluido",
    leadsSaida: total,
    detalhe: { searchId: searchId || null, mapsVerificados },
    contextoPatch: { searchId: searchId || undefined, lote: resultados as unknown as Record<string, unknown>[] },
  };
}
