import type { SupabaseClient } from "@supabase/supabase-js";
import { consultarEmpresaBigDataCorp, bigDataCorpConfigurado } from "../src/lib/integrations/bigdatacorp";

/**
 * Processa execuções de Enriquecimento por CNPJ (BigDataCorp) pendentes —
 * mesmo padrão assíncrono do enriquecimento via IA (worker/enrichment-tick.ts):
 * roda em background, não na requisição HTTP, porque cada lote pode ter
 * várias consultas pagas em sequência.
 */
export async function tickBigDataCorpEnrichment(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  const { data: pendentes } = await sb
    .from("bigdatacorp_enrichment_runs")
    .select("id")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(1);
  if (!pendentes?.length) return;

  // Reserva atômica — só segue se esta chamada foi quem conseguiu virar o
  // status de pendente pra processando (evita dois ticks sobrepostos
  // pegarem a mesma execução).
  const { data: run } = await sb
    .from("bigdatacorp_enrichment_runs")
    .update({ status: "processando" })
    .eq("id", pendentes[0].id)
    .eq("status", "pendente")
    .select()
    .maybeSingle();
  if (!run) return;

  log(`Execução BigDataCorp ${run.id}: iniciando (${run.total} CNPJ(s))`);

  if (!bigDataCorpConfigurado()) {
    await sb
      .from("bigdatacorp_enrichment_runs")
      .update({ status: "erro", erro: "Integração com a BigDataCorp não configurada.", concluido_em: new Date().toISOString() })
      .eq("id", run.id);
    return;
  }

  const { data: leadRows } = await sb
    .from("bigdatacorp_enrichment_leads")
    .select("*")
    .eq("run_id", run.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: true });

  let processados = 0;
  let encontrados = 0;
  let naoEncontrados = 0;
  let erros = 0;

  for (const leadRow of leadRows ?? []) {
    try {
      const resultado = await consultarEmpresaBigDataCorp(leadRow.cnpj_entrada);
      await sb
        .from("bigdatacorp_enrichment_leads")
        .update({
          status: resultado.encontrado ? "concluido" : "nao_encontrado",
          razao_social: resultado.razaoSocial || null,
          socios: resultado.socios,
          telefone: resultado.telefone || null,
          email: resultado.email || null,
          endereco: resultado.endereco || null,
          extras: resultado.bruto as never,
        })
        .eq("id", leadRow.id);
      processados += 1;
      if (resultado.encontrado) encontrados += 1;
      else naoEncontrados += 1;
    } catch (e) {
      await sb.from("bigdatacorp_enrichment_leads").update({ status: "erro", erro: (e as Error).message }).eq("id", leadRow.id);
      processados += 1;
      erros += 1;
    }

    // Atualiza o contador a cada CNPJ — dá o efeito de "barra de
    // progresso" pra quem está com a tela aberta (polling).
    await sb
      .from("bigdatacorp_enrichment_runs")
      .update({ processados, encontrados, nao_encontrados: naoEncontrados, erros })
      .eq("id", run.id);
  }

  await sb.from("bigdatacorp_enrichment_runs").update({ status: "concluido", concluido_em: new Date().toISOString() }).eq("id", run.id);
  log(`Execução BigDataCorp ${run.id}: concluída (${encontrados} encontrado(s), ${naoEncontrados} não encontrado(s), ${erros} erro(s))`);
}
