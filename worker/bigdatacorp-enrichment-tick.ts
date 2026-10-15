import type { SupabaseClient } from "@supabase/supabase-js";
import { directDataConfigurado, ErroDirectData } from "../src/lib/integrations/direct-data";
import { consultarSociosDaEmpresa, normalizarOpcoesCelularSocio } from "../src/lib/celular-socio";
import { custoAcao, debitarCreditos } from "../src/lib/credits";
import { emParalelo } from "../src/lib/paralelo";
import type { BigDataCorpEnrichmentRunRow } from "../src/lib/database.types";

/**
 * Processa execuções do enriquecimento "Sócios e Contato" (celular do sócio,
 * pela Direct Data) pendentes — mesmo padrão assíncrono do enriquecimento
 * via IA (worker/enrichment-tick.ts): roda em background, não na requisição
 * HTTP, porque cada lote tem várias consultas pagas em sequência. As
 * tabelas mantêm o prefixo `bigdatacorp_` do fornecedor anterior.
 */
/**
 * Se o worker reiniciar (deploy, crash) com uma execução em `processando`,
 * ela ficava travada pra sempre — sem isto, nada nunca a devolvia pra
 * `pendente`. Mesmo padrão de `dispatch-db.ts::requeueTravados()`.
 */
async function requeueTravados(sb: SupabaseClient, minutos = 10): Promise<void> {
  const limite = new Date(Date.now() - minutos * 60_000).toISOString();
  await sb.from("bigdatacorp_enrichment_runs").update({ status: "pendente", processando_desde: null })
    .eq("status", "processando").lt("processando_desde", limite);
}

export async function tickBigDataCorpEnrichment(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  await requeueTravados(sb);

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
    .update({ status: "processando", processando_desde: new Date().toISOString() })
    .eq("id", pendentes[0].id)
    .eq("status", "pendente")
    .select()
    .maybeSingle();
  if (!run) return;

  log(`Execução ${run.id} (celular do sócio): iniciando (${run.total} CNPJ(s))`);

  if (!(await directDataConfigurado())) {
    await sb
      .from("bigdatacorp_enrichment_runs")
      .update({ status: "erro", erro: "Consulta de sócios e contato não configurada na plataforma.", concluido_em: new Date().toISOString() })
      .eq("id", run.id);
    return;
  }

  // A execução pode ter sido criada pela tela, por um fluxo ou direto no
  // banco: quem decide se roda é o perfil de agora (recurso liberado) e o
  // saldo, conferido antes de cada consulta paga (o débito satura em 0 e,
  // sozinho, não barraria nada).
  const { data: perfil } = await sb
    .from("profiles")
    .select("bigdatacorp_enrichment_habilitado, role, creditos")
    .eq("id", run.user_id)
    .maybeSingle();
  if (!perfil || (!perfil.bigdatacorp_enrichment_habilitado && perfil.role !== "admin")) {
    await sb
      .from("bigdatacorp_enrichment_runs")
      .update({ status: "erro", erro: "O enriquecimento avançado não está liberado para esta conta.", concluido_em: new Date().toISOString() })
      .eq("id", run.id);
    return;
  }
  await processarComDirectData(sb, run as BigDataCorpEnrichmentRunRow, Number(perfil.creditos) || 0, log);
}

/**
 * Celular do sócio (Direct Data): por CNPJ, a empresa e os sócios; por CPF,
 * o celular de cada sócio escolhido nas opções da execução. Cobra a
 * consulta da empresa ("bigdatacorp") e cada sócio consultado
 * ("socio_celular"), conferindo o saldo antes de cada uma.
 */
async function processarComDirectData(
  sb: SupabaseClient, run: BigDataCorpEnrichmentRunRow, saldoInicial: number, log: (msg: string) => void,
): Promise<void> {
  const opcoes = normalizarOpcoesCelularSocio(run.opcoes);
  const [custoEmpresa, custoSocio] = await Promise.all([custoAcao(sb, "bigdatacorp"), custoAcao(sb, "socio_celular")]);
  let saldo = saldoInicial;

  const { data: leadRows } = await sb
    .from("bigdatacorp_enrichment_leads")
    .select("id, cnpj_entrada")
    .eq("run_id", run.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: true });

  // Recomeço depois de queda: parte da contagem já está gravada.
  const cont = {
    processados: run.processados, encontrados: run.encontrados, naoEncontrados: run.nao_encontrados,
    erros: run.erros, comCelular: run.com_celular ?? 0,
  };
  let erroFatal: string | null = null;
  // `processando_desde` renovado a cada empresa: requeueTravados só devolve
  // para a fila a execução parada há 10 min, não uma busca grande que ainda
  // está andando (senão dois ticks consultariam e cobrariam a mesma empresa).
  const gravarContagem = () =>
    sb.from("bigdatacorp_enrichment_runs").update({
      processados: cont.processados, encontrados: cont.encontrados, nao_encontrados: cont.naoEncontrados,
      erros: cont.erros, com_celular: cont.comCelular, processando_desde: new Date().toISOString(),
    }).eq("id", run.id);

  await emParalelo(leadRows ?? [], 3, async (leadRow) => {
    if (erroFatal) return;
    if (saldo < custoEmpresa) {
      await sb.from("bigdatacorp_enrichment_leads").update({ status: "erro", erro: "Créditos insuficientes." }).eq("id", leadRow.id);
      cont.processados += 1;
      cont.erros += 1;
      await gravarContagem();
      return;
    }
    saldo -= custoEmpresa;
    try {
      const r = await consultarSociosDaEmpresa(
        sb, leadRow.cnpj_entrada, opcoes,
        () => {
          if (saldo < custoSocio) return false;
          saldo -= custoSocio;
          return true;
        },
        () => debitarCreditos(sb, run.user_id, "socio_celular", 1),
      );
      await debitarCreditos(sb, run.user_id, "bigdatacorp", 1);
      await sb.from("bigdatacorp_enrichment_leads").update({
        status: r.encontrado ? "concluido" : "nao_encontrado",
        razao_social: r.razaoSocial || null,
        socios: r.socios as never,
        telefone: r.telefone || null,
        email: r.email || null,
        endereco: r.endereco || null,
        socio_nome: r.socioNome || null,
        socio_cargo: r.socioCargo || null,
        socio_celular: r.socioCelular || null,
        socio_whatsapp: r.socioCelular ? r.socioWhatsapp : null,
        erro: r.aviso,
      }).eq("id", leadRow.id);
      cont.processados += 1;
      if (r.encontrado) cont.encontrados += 1;
      else cont.naoEncontrados += 1;
      if (r.socioCelular) cont.comCelular += 1;
    } catch (e) {
      saldo += custoEmpresa;
      if (e instanceof ErroDirectData && e.fatal) {
        erroFatal = e.message;
        return;
      }
      await sb.from("bigdatacorp_enrichment_leads").update({ status: "erro", erro: (e as Error).message }).eq("id", leadRow.id);
      cont.processados += 1;
      cont.erros += 1;
    }
    await gravarContagem();
  });

  if (erroFatal) {
    // Problema da conta da plataforma (token, saldo no fornecedor): os CNPJs
    // que faltaram ficam sem cobrança e a execução para com o motivo.
    await sb.from("bigdatacorp_enrichment_leads").update({ status: "erro", erro: "Consulta interrompida." }).eq("run_id", run.id).eq("status", "pendente");
    const { count } = await sb.from("bigdatacorp_enrichment_leads").select("id", { count: "exact", head: true }).eq("run_id", run.id).eq("status", "erro");
    await gravarContagem();
    await sb.from("bigdatacorp_enrichment_runs").update({
      status: "erro", erro: erroFatal, processados: run.total, erros: count ?? cont.erros, concluido_em: new Date().toISOString(),
    }).eq("id", run.id);
    log(`Execução ${run.id} (celular do sócio): interrompida — ${erroFatal}`);
    return;
  }

  await gravarContagem();
  if (run.search_id) await gravarNaPesquisa(sb, run);
  await sb.from("bigdatacorp_enrichment_runs").update({ status: "concluido", concluido_em: new Date().toISOString() }).eq("id", run.id);
  log(`Execução ${run.id} (celular do sócio): ${cont.comCelular} com celular de ${cont.processados} empresa(s), ${cont.erros} erro(s)`);
}

/**
 * Busca por CNPJ com a opção ligada: o celular e o nome do sócio voltam
 * para os leads da pesquisa. No modo "vários sócios", o primeiro sócio com
 * celular fica no lead da empresa e cada sócio a mais com celular vira um
 * lead novo na mesma pesquisa (mesma empresa, outro contato) — é o que o
 * disparo e o histórico enxergam.
 */
async function gravarNaPesquisa(sb: SupabaseClient, run: BigDataCorpEnrichmentRunRow): Promise<void> {
  const { data } = await sb
    .from("bigdatacorp_enrichment_leads")
    .select("cnpj_entrada, socio_nome, socio_celular, socios")
    .eq("run_id", run.id)
    .not("socio_celular", "is", null);
  if (!data?.length) return;
  const varios = normalizarOpcoesCelularSocio(run.opcoes).socios === "todos";
  const porCnpj = new Map(data.map((r) => [r.cnpj_entrada as string, r]));
  const { data: leads } = await sb.from("leads").select("*").eq("search_id", run.search_id!).not("cnpj", "is", null);
  const novos: Array<Record<string, unknown>> = [];
  for (const lead of (leads ?? []) as Array<Record<string, unknown>>) {
    const r = porCnpj.get(String(lead.cnpj).replace(/\D/g, ""));
    if (!r) continue;
    await sb.from("leads")
      .update({ celular_socio: r.socio_celular, ...(r.socio_nome ? { socio_principal: r.socio_nome } : {}) })
      .eq("id", lead.id);
    if (!varios) continue;
    const extras = (Array.isArray(r.socios) ? (r.socios as Array<{ nome: string; celular?: string | null }>) : [])
      .filter((s) => s.celular && s.celular !== r.socio_celular);
    for (const s of extras) {
      const copia: Record<string, unknown> = { ...lead, celular_socio: s.celular, socio_principal: s.nome };
      delete copia.id;
      delete copia.created_at;
      novos.push(copia);
    }
  }
  for (let i = 0; i < novos.length; i += 500) await sb.from("leads").insert(novos.slice(i, i + 500));
  if (novos.length) {
    // O total da pesquisa no Histórico acompanha os leads novos.
    const { count } = await sb.from("leads").select("id", { count: "exact", head: true }).eq("search_id", run.search_id!);
    if (count != null) await sb.from("searches").update({ total_results: count }).eq("id", run.search_id!);
  }
}
