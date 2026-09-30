import { getProfile, debitarCreditos, custoAcao } from "@/lib/credits";
import { chaveApify } from "@/lib/platform-keys";
import { buscarLinkedIn } from "@/lib/integrations/linkedin";
import { salvarPesquisa, salvarLeads, buscarLinkedInUrlsExistentes } from "@/lib/db";
import type { Json } from "@/lib/database.types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

export async function executarExtracaoLinkedin(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const cargos = Array.isArray(config.cargos) ? (config.cargos as string[]) : [];
  const localizacoes = Array.isArray(config.localizacoes) ? (config.localizacoes as string[]) : [];
  const industrias = Array.isArray(config.industrias) ? (config.industrias as string[]) : [];
  const palavraChave = String(config.palavraChave || "");
  const buscarEmail = Boolean(config.buscarEmail);
  const apenasNovos = config.apenasNovos !== false;
  const limite = Number(config.limite ?? 100);

  const profile = await getProfile(sb, userId);
  if (!profile) return { status: "erro", erro: "Perfil não encontrado." };
  if (!profile.linkedin_visible) return { status: "erro", erro: "A busca por LinkedIn não está habilitada para sua conta." };
  const custo = await custoAcao(sb, "linkedin");
  if (profile.creditos < limite * custo) {
    return { status: "erro", erro: `Créditos insuficientes (${profile.creditos} disponíveis, até ${limite * custo} necessários).` };
  }

  const apifyApiKey = await chaveApify();
  if (!apifyApiKey) return { status: "erro", erro: "Extração indisponível no momento (chave da plataforma não configurada)." };

  const excludeUrls = apenasNovos ? await buscarLinkedInUrlsExistentes(sb, userId) : undefined;

  let resultados;
  try {
    resultados = await buscarLinkedIn({
      apifyApiKey,
      cargos,
      localizacoes,
      industrias,
      palavraChave,
      buscarEmail,
      limite,
      excludeUrls,
    });
  } catch (e) {
    return { status: "erro", erro: (e as Error).message };
  }

  const total = resultados.length;
  const searchId = await salvarPesquisa(sb, userId, {
    fonte: "linkedin",
    nicho: "LinkedIn",
    subnicho: cargos.join(", "),
    cidade: "",
    estado: "",
    localidade: localizacoes.join(", "),
    totalResults: total,
    filtros: config as Json,
  });
  if (searchId && total) await salvarLeads(sb, userId, searchId, resultados);
  await debitarCreditos(sb, userId, "linkedin", total);

  return {
    status: "concluido",
    leadsSaida: total,
    detalhe: { searchId: searchId || null },
    contextoPatch: { searchId: searchId || undefined, lote: resultados as unknown as Record<string, unknown>[] },
  };
}
