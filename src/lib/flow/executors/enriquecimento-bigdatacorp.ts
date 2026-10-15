import type { BigDataCorpEnrichmentLeadRow, BigDataCorpEnrichmentRunRow } from "@/lib/database.types";
import { normalizarOpcoesCelularSocio } from "@/lib/celular-socio";
import { mesclarBigDataCorpNoLote } from "../enrichment-merge";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Saída "Sem celular" ligada: quem não teve o celular do sócio encontrado
 * (ou nem tinha CNPJ) vai por ela. Sem ligação, todo mundo segue pelo
 * caminho principal, com o telefone que já tinha.
 */
function separarPorCelular(lote: Array<Record<string, unknown>>, saidasConectadas: string[]) {
  if (!saidasConectadas.includes("sem_celular")) return { principal: lote, saidas: undefined };
  const comCelular = lote.filter((l) => l.socio_celular);
  const semCelular = lote.filter((l) => !l.socio_celular);
  return { principal: comCelular, saidas: { sem_celular: semCelular } };
}

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
  const { sb, userId, contexto, node, saidasConectadas } = ctx;
  const lote = contexto.lote || [];

  const runIdExistente = contexto.bigdatacorpRunId as string | undefined;
  if (runIdExistente) {
    const { data: run } = await sb.from("bigdatacorp_enrichment_runs").select("*").eq("id", runIdExistente).single();
    if (!run) return { status: "erro", erro: "Execução do celular do sócio não encontrada." };
    if (run.status === "concluido") {
      const { data: bigdatacorpLeads } = await sb.from("bigdatacorp_enrichment_leads").select("*").eq("run_id", runIdExistente);
      const opcoes = normalizarOpcoesCelularSocio((run as BigDataCorpEnrichmentRunRow).opcoes);
      const loteEnriquecido = mesclarBigDataCorpNoLote(lote, (bigdatacorpLeads as BigDataCorpEnrichmentLeadRow[]) || [], {
        umLeadPorSocio: opcoes.socios === "todos",
      });
      const { principal, saidas } = separarPorCelular(loteEnriquecido, saidasConectadas);
      return {
        status: "concluido",
        leadsEntrada: lote.length,
        leadsSaida: principal.length,
        detalhe: {
          bigdatacorpRunId: runIdExistente, encontrados: run.encontrados, naoEncontrados: run.nao_encontrados, erros: run.erros,
          comCelular: run.com_celular ?? 0,
          ...(run.erros ? { aviso: `${run.erros} empresa(s) com erro na consulta${run.erro ? `: ${run.erro}` : ""}.` } : {}),
        },
        // Limpa a marca: outro nó de enriquecimento mais adiante (ou num
        // ramo que herdou este contexto) precisa criar a própria execução.
        contextoPatch: { lote: principal, bigdatacorpRunId: undefined },
        saidas,
      };
    }
    if (run.status === "erro") {
      return { status: "erro", erro: run.erro || "A busca do celular do sócio falhou.", detalhe: { bigdatacorpRunId: runIdExistente } };
    }
    return { status: "aguardando_subprocesso", detalhe: { bigdatacorpRunId: runIdExistente, processados: run.processados, total: run.total } };
  }

  const itens = lote
    .map((l) => ({ cnpj: String(l.cnpj || ""), nomeLead: String(l.nome || "") }))
    .filter((l) => l.cnpj.replace(/\D/g, "").length === 14);

  // Sem CNPJ não há o que consultar (ex.: lote vindo do Google Maps). Não é
  // erro: o lote segue como está, sem gastar crédito, e o aviso aparece no
  // histórico. Antes isso virava erro e a execução tentava de novo 3 vezes.
  if (!itens.length) {
    const { principal, saidas } = separarPorCelular(lote, saidasConectadas);
    return {
      status: "concluido", leadsEntrada: lote.length, leadsSaida: principal.length,
      detalhe: { aviso: "Nenhum lead tinha CNPJ: o lote seguiu sem enriquecer." },
      contextoPatch: { lote: principal },
      saidas,
    };
  }

  const { data: run, error: runError } = await sb
    .from("bigdatacorp_enrichment_runs")
    .insert({ user_id: userId, status: "pendente", total: itens.length, origem: "fluxo", opcoes: normalizarOpcoesCelularSocio(node.config) })
    .select()
    .single();
  if (runError || !run) return { status: "erro", erro: "Não foi possível criar a execução do celular do sócio." };

  const linhas = itens.map((item) => ({
    run_id: run.id, user_id: userId, cnpj_entrada: item.cnpj, nome_lead: item.nomeLead || null, status: "pendente" as const,
  }));
  const { error: leadsError } = await sb.from("bigdatacorp_enrichment_leads").insert(linhas);
  if (leadsError) {
    await sb.from("bigdatacorp_enrichment_runs").delete().eq("id", run.id);
    return { status: "erro", erro: "Não foi possível salvar os CNPJs da execução do celular do sócio." };
  }

  return {
    status: "aguardando_subprocesso",
    detalhe: { bigdatacorpRunId: run.id, total: itens.length },
    contextoPatch: { bigdatacorpRunId: run.id },
  };
}
