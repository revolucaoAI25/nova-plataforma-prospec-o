import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requeueTravados, listarInstanciasConectadas, claimTargetParaInstancia, obterCampanha,
  listarEtapas, proximaEtapa, marcarEnviado, marcarFalha, liberarProximoEnvio,
  listarCampanhasSheetWatchAtivas, listarCampanhasAutoTriggerAtivas, obterSheetWatcher,
  atualizarSheetWatcher, enrollTargets, buscarLeadsFiltro, atualizarCampanha, obterTemplateDb,
} from "../src/lib/dispatch-db";
import { enviarTexto as evolutionEnviarTexto } from "../src/lib/integrations/evolution-api";
import { enviarTemplate as oficialEnviarTemplate } from "../src/lib/integrations/whatsapp-oficial";
import { lerValores } from "../src/lib/integrations/google-sheets";
import { getProfile } from "../src/lib/credits";
import type { CadenceStepRow, DispatchCampaignRow, DispatchTargetRow, WhatsappInstanceRow, GoogleSheetsCreds } from "../src/lib/database.types";

function renderizarMensagem(corpo: string, leadSnapshot: Record<string, unknown> | null): string {
  let texto = corpo || "";
  for (const [chave, valor] of Object.entries(leadSnapshot || {})) {
    texto = texto.split(`{{${chave}}}`).join(String(valor ?? ""));
  }
  return texto;
}

function instanciaLiberada(instance: WhatsappInstanceRow): boolean {
  if (!instance.proximo_envio_liberado_em) return true;
  return new Date() >= new Date(instance.proximo_envio_liberado_em);
}

function etapaAtualOrdem(target: DispatchTargetRow, etapas: CadenceStepRow[]): number {
  if (!target.current_step_id) return 0;
  return etapas.find((e) => e.id === target.current_step_id)?.ordem ?? 0;
}

async function enviarEtapaEvolution(instance: WhatsappInstanceRow, target: DispatchTargetRow, step: CadenceStepRow) {
  const texto = renderizarMensagem(step.corpo_mensagem, target.lead_snapshot as Record<string, unknown>);
  const resp = await evolutionEnviarTexto(instance.evolution_instance_name!, target.telefone, texto);
  return { msgId: resp?.key?.id || "", corpoLog: texto };
}

async function enviarEtapaOficial(sb: SupabaseClient, instance: WhatsappInstanceRow, target: DispatchTargetRow, step: CadenceStepRow) {
  if (!step.template_id) throw new Error("Etapa sem template configurado — instância é do canal oficial.");
  const template = await obterTemplateDb(sb, step.template_id);
  if (!template) throw new Error("Template da etapa não encontrado (pode ter sido excluído).");
  if (template.status_aprovacao !== "approved") {
    throw new Error(`Template '${template.nome}' não está aprovado (status: ${template.status_aprovacao}).`);
  }

  const leadSnapshot = (target.lead_snapshot as Record<string, unknown>) || {};
  const parametros = (step.parametros_template || []).map((p) => renderizarMensagem(p, leadSnapshot));
  const resp = await oficialEnviarTemplate(
    instance.token_oficial!, instance.phone_number_id!, target.telefone,
    template.nome_meta!, template.idioma || "pt_BR", parametros,
  );
  const msgId = resp?.messages?.[0]?.id || "";
  return { msgId, corpoLog: parametros.join(" | ") };
}

async function processarInstancia(sb: SupabaseClient, instance: WhatsappInstanceRow, log: (msg: string) => void) {
  if (instance.status !== "conectado" || !instanciaLiberada(instance)) return;

  const target = await claimTargetParaInstancia(sb, instance.id);
  if (!target) return;

  const campanha = await obterCampanha(sb, target.campaign_id);
  if (!campanha || campanha.status !== "ativa") {
    await marcarFalha(sb, target, target.campaign_id, null, "Campanha não está mais ativa nesse momento.");
    return;
  }

  const etapas = await listarEtapas(sb, target.campaign_id);
  const ordemAtual = etapaAtualOrdem(target, etapas);
  const step = proximaEtapa(etapas, ordemAtual);

  if (!step) {
    await sb.from("dispatch_targets").update({ status: "concluido", atualizado_em: new Date().toISOString() }).eq("id", target.id);
    return;
  }

  try {
    const { msgId, corpoLog } = instance.canal === "oficial"
      ? await enviarEtapaOficial(sb, instance, target, step)
      : await enviarEtapaEvolution(instance, target, step);
    await marcarEnviado(sb, target, target.campaign_id, step, etapas, msgId, corpoLog);
  } catch (e) {
    log(`Falha ao enviar mensagem (target=${target.id}): ${(e as Error).message}`);
    await marcarFalha(sb, target, target.campaign_id, step, (e as Error).message);
  }

  await liberarProximoEnvio(sb, instance.id, campanha.intervalo_min_seg, campanha.intervalo_max_seg);
}

async function processarSheetWatcher(sb: SupabaseClient, campanha: DispatchCampaignRow, log: (msg: string) => void) {
  const watcher = await obterSheetWatcher(sb, campanha.id);
  if (!watcher) return;

  const profile = await getProfile(sb, campanha.user_id);
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds | null)?.oauth;
  if (!creds) {
    log(`Campanha ${campanha.id} (sheet_watch): usuário sem Google Sheets conectado.`);
    return;
  }

  let valores: string[][];
  try {
    valores = await lerValores(creds, watcher.sheet_id, watcher.aba_nome);
  } catch (e) {
    log(`Campanha ${campanha.id} (sheet_watch): erro ao ler planilha: ${(e as Error).message}`);
    return;
  }
  if (!valores.length) return;

  const [cabecalho, ...linhas] = valores;
  const jaProcessadas = watcher.ultima_linha_processada || 0;
  const novas = linhas.slice(jaProcessadas);
  if (!novas.length) return;

  const idxTel = cabecalho.indexOf(watcher.coluna_telefone);
  if (idxTel < 0) {
    log(`Campanha ${campanha.id} (sheet_watch): coluna de telefone '${watcher.coluna_telefone}' não existe mais no cabeçalho.`);
    return;
  }
  const idxNome = watcher.coluna_nome ? cabecalho.indexOf(watcher.coluna_nome) : -1;

  const leads = novas.map((linha) => {
    const lead: Record<string, unknown> = {};
    cabecalho.forEach((col, i) => { lead[col] = linha[i] ?? ""; });
    lead.telefone = linha[idxTel] ?? "";
    lead.nome = idxNome >= 0 ? linha[idxNome] ?? "" : "";
    return lead;
  });

  const resultado = await enrollTargets(sb, campanha.id, leads);
  await atualizarSheetWatcher(sb, watcher.id, { ultima_linha_processada: linhas.length });
  log(`Campanha ${campanha.id} (sheet_watch): ${novas.length} linha(s) nova(s), ${resultado.inscritos} inscrita(s).`);
}

async function processarAutoTrigger(sb: SupabaseClient, campanha: DispatchCampaignRow, log: (msg: string) => void) {
  const leads = await buscarLeadsFiltro(
    sb, campanha.user_id, campanha.filtro_nicho || "", campanha.filtro_subnicho || "",
    campanha.filtro_uf || "", campanha.ultimo_trigger_em,
  );
  const agoraIso = new Date().toISOString();
  if (!leads.length) {
    await atualizarCampanha(sb, campanha.id, { ultimo_trigger_em: agoraIso });
    return;
  }
  const resultado = await enrollTargets(sb, campanha.id, leads);
  await atualizarCampanha(sb, campanha.id, { ultimo_trigger_em: agoraIso });
  log(`Campanha ${campanha.id} (auto_trigger): ${leads.length} lead(s) novo(s), ${resultado.inscritos} inscrito(s).`);
}

/** Fila de envio — roda a cada TICK_SEGUNDOS. */
export async function tickDispatch(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  await requeueTravados(sb);
  const instancias = await listarInstanciasConectadas(sb);
  for (const inst of instancias) {
    try {
      await processarInstancia(sb, inst, log);
    } catch (e) {
      log(`Erro processando instância ${inst.id}: ${(e as Error).message}`);
    }
  }
}

/** Scan lento de sheet_watch + auto_trigger — roda a cada SHEET_WATCH_INTERVALO_SEGUNDOS. */
export async function tickSheetWatchAndAutoTrigger(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  for (const campanha of await listarCampanhasSheetWatchAtivas(sb)) {
    try {
      await processarSheetWatcher(sb, campanha, log);
    } catch (e) {
      log(`Erro processando sheet_watch da campanha ${campanha.id}: ${(e as Error).message}`);
    }
  }
  for (const campanha of await listarCampanhasAutoTriggerAtivas(sb)) {
    try {
      await processarAutoTrigger(sb, campanha, log);
    } catch (e) {
      log(`Erro processando auto_trigger da campanha ${campanha.id}: ${(e as Error).message}`);
    }
  }
}
