import type { BigDataCorpEnrichmentLeadRow } from "@/lib/database.types";
import { mesclarBigDataCorpNoLote } from "../enrichment-merge";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Nó assíncrono, mesmo padrão de executarEnriquecimentoIa: na primeira vez
 * cria um `bigdatacorp_enrichment_run` (mesmo formato de POST
 * /api/bigdatacorp-enrichment) e devolve `aguardando_subprocesso` — quem
 * processa de fato é o tick já existente (worker/bigdatacorp-enrichment-tick.ts,
 * a cada 10s), não reimplementado aqui. Só funciona em leads que já têm
 * `cnpj` no lote (vindos de extração CNPJ, ou de qualquer fonte que já
 * tenha cruzado com CNPJ antes) — leads sem CNPJ (ex.: Google Maps puro)
 * são ignorados silenciosamente, mesmo critério do `dominioVerificadoPeloUsuario`
 * pro disparo por e-mail: sem o dado necessário, o nó não inventa.
 */
export async function executarEnriquecimentoBigDataCorp(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, contexto } = ctx;
  const lote = contexto.lote || [];

  const runIdExistente = contexto.bigdatacorpRunId as string | undefined;
  if (runIdExistente) {
    const { data: run } = await sb.from("bigdatacorp_enrichment_runs").select("*").eq("id", runIdExistente).single();
    if (!run) return { status: "erro", erro: "Execução de enriquecimento BigDataCorp não encontrada." };
    if (run.status === "concluido") {
      const { data: bigdatacorpLeads } = await sb.from("bigdatacorp_enrichment_leads").select("*").eq("run_id", runIdExistente);
      const loteEnriquecido = mesclarBigDataCorpNoLote(lote, (bigdatacorpLeads as BigDataCorpEnrichmentLeadRow[]) || []);
      return {
        status: "concluido",
        leadsEntrada: lote.length,
        leadsSaida: lote.length,
        detalhe: { bigdatacorpRunId: runIdExistente, encontrados: run.encontrados, naoEncontrados: run.nao_encontrados, erros: run.erros },
        contextoPatch: { lote: loteEnriquecido },
      };
    }
    if (run.status === "erro") {
      return { status: "erro", erro: run.erro || "Enriquecimento BigDataCorp falhou.", detalhe: { bigdatacorpRunId: runIdExistente } };
    }
    return { status: "aguardando_subprocesso", detalhe: { bigdatacorpRunId: runIdExistente, processados: run.processados, total: run.total } };
  }

  const itens = lote
    .map((l) => ({ cnpj: String(l.cnpj || ""), nomeLead: String(l.nome || "") }))
    .filter((l) => l.cnpj.replace(/\D/g, "").length === 14);

  if (!itens.length) {
    return { status: "erro", erro: "Nenhum lead do lote tem CNPJ para consultar na BigDataCorp." };
  }

  const { data: run, error: runError } = await sb
    .from("bigdatacorp_enrichment_runs")
    .insert({ user_id: userId, status: "pendente", total: itens.length, origem: "fluxo" })
    .select()
    .single();
  if (runError || !run) return { status: "erro", erro: "Não foi possível criar a execução de enriquecimento BigDataCorp." };

  const linhas = itens.map((item) => ({
    run_id: run.id, user_id: userId, cnpj_entrada: item.cnpj, nome_lead: item.nomeLead || null, status: "pendente" as const,
  }));
  const { error: leadsError } = await sb.from("bigdatacorp_enrichment_leads").insert(linhas);
  if (leadsError) {
    await sb.from("bigdatacorp_enrichment_runs").delete().eq("id", run.id);
    return { status: "erro", erro: "Não foi possível salvar os CNPJs da execução de enriquecimento BigDataCorp." };
  }

  return {
    status: "aguardando_subprocesso",
    detalhe: { bigdatacorpRunId: run.id, total: itens.length },
    contextoPatch: { bigdatacorpRunId: run.id },
  };
}
