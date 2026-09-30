import { getProfile, debitarCreditos, custoAcao } from "@/lib/credits";
import { chaveApify } from "@/lib/platform-keys";
import { buscarInstagram } from "@/lib/integrations/instagram";
import { salvarPesquisa, salvarLeads, buscarInstagramIdsExistentes } from "@/lib/db";
import type { Json } from "@/lib/database.types";
import type { InstagramTipo } from "@/lib/types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

export async function executarExtracaoInstagram(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const termoBusca = String(config.termoBusca || "").trim();
  if (!termoBusca) return { status: "erro", erro: "Informe o termo de busca (perfil) do Instagram." };
  const tipo: InstagramTipo = config.tipo === "seguindo" ? "seguindo" : "seguidores";
  const apenasNovos = config.apenasNovos !== false;
  const limite = Number(config.limite ?? 200);

  const profile = await getProfile(sb, userId);
  if (!profile) return { status: "erro", erro: "Perfil não encontrado." };
  if (!profile.instagram_visible) return { status: "erro", erro: "A busca por Instagram não está habilitada para sua conta." };
  const custo = await custoAcao(sb, "instagram");
  if (profile.creditos < limite * custo) {
    return { status: "erro", erro: `Créditos insuficientes (${profile.creditos} disponíveis, até ${limite * custo} necessários).` };
  }

  const apifyApiKey = await chaveApify();
  if (!apifyApiKey) return { status: "erro", erro: "Extração indisponível no momento (chave da plataforma não configurada)." };

  const excludeIds = apenasNovos ? await buscarInstagramIdsExistentes(sb, userId) : undefined;

  let resultados;
  try {
    resultados = await buscarInstagram({
      apifyApiKey,
      tipo,
      alvo: termoBusca,
      limite,
      excludeIds,
    });
  } catch (e) {
    return { status: "erro", erro: (e as Error).message };
  }

  const total = resultados.length;
  const searchId = await salvarPesquisa(sb, userId, {
    fonte: "instagram",
    nicho: "Instagram",
    subnicho: tipo === "seguindo" ? "Following" : "Seguidor",
    cidade: "",
    estado: "",
    localidade: termoBusca,
    totalResults: total,
    filtros: config as Json,
  });
  if (searchId && total) await salvarLeads(sb, userId, searchId, resultados);
  await debitarCreditos(sb, userId, "instagram", total);

  return {
    status: "concluido",
    leadsSaida: total,
    detalhe: { searchId: searchId || null },
    contextoPatch: { searchId: searchId || undefined, lote: resultados as unknown as Record<string, unknown>[] },
  };
}
