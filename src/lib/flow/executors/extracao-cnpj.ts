import { getProfile, debitarCreditos } from "@/lib/credits";
import { buscarCnpj } from "@/lib/integrations/casa-dos-dados";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes } from "@/lib/db";
import type { Json } from "@/lib/database.types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

export async function executarExtracaoCnpj(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;

  const profile = await getProfile(sb, userId);
  if (!profile) return { status: "erro", erro: "Perfil não encontrado." };

  const apiKey = profile.cdd_api_key || profile.cdd_api_key_admin || process.env.CDD_API_KEY || "";
  if (!apiKey) return { status: "erro", erro: "Chave da Casa dos Dados (CDD) não configurada." };
  if (profile.cdd_credits < 1) return { status: "erro", erro: "Créditos de busca CNPJ insuficientes." };

  const limite = Math.min(Number(config.limite ?? 100), profile.cdd_credits);
  const { telefones, cnpjs } = await buscarIdentificadoresExistentes(sb, userId);

  let resultados;
  try {
    resultados = await buscarCnpj({
      apiKey,
      cnaes: config.cnae ? [String(config.cnae)] : [],
      uf: String(config.uf || ""),
      municipio: String(config.cidade || ""),
      porte: config.porte ? [String(config.porte)] : null,
      comTelefone: true,
      excluirEmailContab: true,
      limite,
      excludePhones: telefones,
      excludeCnpjs: cnpjs,
    });
  } catch (e) {
    return { status: "erro", erro: (e as Error).message };
  }

  const total = resultados.length;
  const searchId = await salvarPesquisa(sb, userId, {
    fonte: "cnpj",
    nicho: String(config.nicho || ""),
    subnicho: "",
    cidade: String(config.cidade || ""),
    estado: String(config.uf || ""),
    localidade: String(config.cidade || config.uf || ""),
    totalResults: total,
    filtros: config as Json,
  });
  if (searchId && total) await salvarLeads(sb, userId, searchId, resultados);
  if (total > 0) await debitarCreditos(sb, userId, "cdd_credits", total);

  return {
    status: "concluido",
    leadsSaida: total,
    detalhe: { searchId: searchId || null },
    contextoPatch: { searchId: searchId || undefined, lote: resultados as unknown as Record<string, unknown>[] },
  };
}
