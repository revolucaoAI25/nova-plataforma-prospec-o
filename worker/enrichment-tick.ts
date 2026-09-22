import type { SupabaseClient } from "@supabase/supabase-js";
import { enriquecerLead } from "../src/lib/integrations/lead-enrichment";
import type { EnrichmentOpcoes } from "../src/lib/database.types";

/**
 * Processa execuções de Enriquecimento de Leads via IA pendentes —
 * diferente do produto atual (que roda síncrono na mesma requisição HTTP e
 * só mantém o resultado em session_state), aqui roda em background pelo
 * worker, igual às automações: evita perder um lote de buscas PAGAS (custo
 * é do usuário na própria conta OpenAI) por atualizar a página, e não
 * depende de manter uma requisição aberta por vários minutos (cada busca
 * pode levar até 240s, e um lote tem até 50 leads).
 */
export async function tickEnrichment(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  const { data: pendentes } = await sb
    .from("enrichment_runs")
    .select("id")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(1);
  if (!pendentes?.length) return;

  // Reserva atômica — só segue se esta chamada foi quem conseguiu virar o
  // status de pendente pra processando (evita dois ticks sobrepostos
  // pegarem a mesma execução).
  const { data: run } = await sb
    .from("enrichment_runs")
    .update({ status: "processando" })
    .eq("id", pendentes[0].id)
    .eq("status", "pendente")
    .select()
    .maybeSingle();
  if (!run) return;

  log(`Execução ${run.id}: iniciando (${run.total} lead(s))`);

  const { data: profile } = await sb
    .from("profiles")
    .select("openai_api_key, enriquecimento_ia_habilitado, role")
    .eq("id", run.user_id)
    .single();

  const habilitado = profile && (profile.enriquecimento_ia_habilitado || profile.role === "admin");
  if (!profile || !habilitado || !profile.openai_api_key) {
    await sb
      .from("enrichment_runs")
      .update({
        status: "erro",
        erro: !habilitado
          ? "Acesso ao Enriquecimento de Leads via IA foi desabilitado para esta conta."
          : "Chave da OpenAI não configurada.",
        concluido_em: new Date().toISOString(),
      })
      .eq("id", run.id);
    return;
  }

  const { data: leadRows } = await sb
    .from("enrichment_leads")
    .select("*")
    .eq("run_id", run.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: true });

  const opcoes = (run.opcoes || {}) as EnrichmentOpcoes;
  let processados = 0;
  let encontrados = 0;
  let naoEncontrados = 0;
  let erros = 0;

  for (const leadRow of leadRows ?? []) {
    const resultado = await enriquecerLead(
      leadRow.nome_lead || "",
      leadRow.email || "",
      leadRow.telefone || "",
      profile.openai_api_key,
      opcoes,
    );

    await sb
      .from("enrichment_leads")
      .update({
        status: resultado.status,
        empresa_nome: resultado.empresa_nome,
        cnpj: resultado.cnpj,
        municipio: resultado.municipio,
        uf: resultado.uf,
        website: resultado.website,
        cargo: resultado.cargo,
        linkedin_url: resultado.linkedin_url,
        resumo: resultado.resumo,
        socios: resultado.socios,
        fundacao: resultado.fundacao,
        processos_jusbrasil: resultado.processos_jusbrasil,
        extras: resultado.extras,
        erro: resultado.erro,
      })
      .eq("id", leadRow.id);

    processados += 1;
    if (resultado.status === "concluido") encontrados += 1;
    else if (resultado.status === "erro") erros += 1;
    else naoEncontrados += 1;

    // Atualiza o contador a cada lead — é isso que dá o efeito de "barra de
    // progresso" pra quem está com a tela de enriquecimento aberta (polling).
    await sb
      .from("enrichment_runs")
      .update({ processados, encontrados, nao_encontrados: naoEncontrados, erros })
      .eq("id", run.id);
  }

  await sb.from("enrichment_runs").update({ status: "concluido", concluido_em: new Date().toISOString() }).eq("id", run.id);
  log(`Execução ${run.id}: concluída (${encontrados} encontrado(s), ${naoEncontrados} não encontrado(s), ${erros} erro(s))`);
}
