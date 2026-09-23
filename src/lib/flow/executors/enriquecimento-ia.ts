import type { EnrichmentOpcoes } from "@/lib/database.types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

const LIMITE_LOTE = 50;

/**
 * Nó assíncrono: na primeira vez, cria um `enrichment_run` (mesmo formato
 * de POST /api/enrichment) e devolve `aguardando_subprocesso` — o
 * processamento de fato é feito pelo tick de enriquecimento já existente
 * (worker/enrichment-tick.ts, a cada 10s), não reimplementado aqui. Nas
 * chamadas seguintes só verifica se aquele run já concluiu.
 */
export async function executarEnriquecimentoIa(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const lote = contexto.lote || [];

  const runIdExistente = contexto.enrichmentRunId;
  if (runIdExistente) {
    const { data: run } = await sb.from("enrichment_runs").select("*").eq("id", runIdExistente).single();
    if (!run) return { status: "erro", erro: "Execução de enriquecimento não encontrada." };
    if (run.status === "concluido") {
      return {
        status: "concluido",
        leadsEntrada: lote.length,
        leadsSaida: lote.length,
        detalhe: { enrichmentRunId: runIdExistente, encontrados: run.encontrados, naoEncontrados: run.nao_encontrados, erros: run.erros },
      };
    }
    if (run.status === "erro") {
      return { status: "erro", erro: run.erro || "Enriquecimento falhou.", detalhe: { enrichmentRunId: runIdExistente } };
    }
    return { status: "aguardando_subprocesso", detalhe: { enrichmentRunId: runIdExistente, processados: run.processados, total: run.total } };
  }

  const leadsValidos = lote
    .map((l) => ({ nome: String(l.nome || ""), email: String(l.email || ""), telefone: String(l.telefone || "") }))
    .filter((l) => l.email.trim() || l.telefone.trim())
    .slice(0, LIMITE_LOTE);

  if (!leadsValidos.length) {
    return { status: "erro", erro: "Nenhum lead do lote tem e-mail ou telefone para enriquecer." };
  }

  const opcoes: EnrichmentOpcoes = {
    nivelRaciocinio: (config.nivelRaciocinio as EnrichmentOpcoes["nivelRaciocinio"]) || "equilibrado",
    buscarSocios: config.buscarSocios !== false,
    buscarFundacao: config.buscarFundacao !== false,
    buscarProcessos: config.buscarProcessos !== false,
    camposCustomizados: Array.isArray(config.camposCustomizados) ? (config.camposCustomizados as string[]) : [],
  };

  const { data: run, error: runError } = await sb
    .from("enrichment_runs")
    .insert({ user_id: userId, status: "pendente", total: leadsValidos.length, opcoes })
    .select()
    .single();
  if (runError || !run) return { status: "erro", erro: "Não foi possível criar a execução de enriquecimento." };

  const linhas = leadsValidos.map((l) => ({
    run_id: run.id, user_id: userId, nome_lead: l.nome, email: l.email, telefone: l.telefone, status: "pendente" as const,
  }));
  const { error: leadsError } = await sb.from("enrichment_leads").insert(linhas);
  if (leadsError) {
    await sb.from("enrichment_runs").delete().eq("id", run.id);
    return { status: "erro", erro: "Não foi possível salvar os leads da execução de enriquecimento." };
  }

  return {
    status: "aguardando_subprocesso",
    detalhe: { enrichmentRunId: run.id, total: leadsValidos.length },
    contextoPatch: { enrichmentRunId: run.id },
  };
}
