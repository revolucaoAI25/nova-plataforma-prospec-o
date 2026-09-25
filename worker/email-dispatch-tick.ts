import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requeueTravadosEmail, listarCampanhasEmailAtivas, obterSender, claimEmailTargets,
  listarEtapasEmail, proximaEtapaEmail, marcarEnviadoEmail, marcarFalhaEmail, liberarProximoEnvioSender,
  listarCampanhasEmailSheetWatchAtivas, listarCampanhasEmailAutoTriggerAtivas, obterSheetWatcherEmail,
  atualizarSheetWatcherEmail, enrollEmailTargets, buscarLeadsFiltro, atualizarCampanhaEmail,
  contarEnviosHojeSender, estaOptOutEmail,
} from "../src/lib/email-dispatch-db";
import { enviarLoteEmails, textoParaHtml, type EmailEnvio } from "../src/lib/integrations/resend";
import { lerValores } from "../src/lib/integrations/google-sheets";
import { getProfile } from "../src/lib/credits";
import type { EmailCampaignRow, EmailSenderRow, EmailTargetRow, EmailCadenceStepRow, GoogleSheetsCreds } from "../src/lib/database.types";

const EMAIL_BATCH_SIZE = 20;

function renderizarMensagemEmail(texto: string, leadSnapshot: Record<string, unknown> | null): string {
  let out = texto || "";
  for (const [chave, valor] of Object.entries(leadSnapshot || {})) {
    out = out.split(`{{${chave}}}`).join(String(valor ?? ""));
  }
  return out;
}

function senderLiberado(sender: EmailSenderRow): boolean {
  if (!sender.proximo_envio_liberado_em) return true;
  return new Date() >= new Date(sender.proximo_envio_liberado_em);
}

function etapaAtualOrdem(target: EmailTargetRow, etapas: EmailCadenceStepRow[]): number {
  if (!target.current_step_id) return 0;
  return etapas.find((e) => e.id === target.current_step_id)?.ordem ?? 0;
}

async function processarCampanha(sb: SupabaseClient, campanha: EmailCampaignRow, log: (msg: string) => void) {
  if (!campanha.sender_id) return;
  const sender = await obterSender(sb, campanha.sender_id);
  if (!sender || !sender.ativo || !senderLiberado(sender)) return;

  if (sender.limite_diario_envios) {
    const enviosHoje = await contarEnviosHojeSender(sb, sender.id);
    if (enviosHoje >= sender.limite_diario_envios) return;
  }

  const targets = await claimEmailTargets(sb, campanha.id, EMAIL_BATCH_SIZE);
  if (!targets.length) return;

  const etapas = await listarEtapasEmail(sb, campanha.id);
  const from = `${sender.from_name} <${sender.from_email}>`;

  const envios: Array<{ target: EmailTargetRow; step: EmailCadenceStepRow; envio: EmailEnvio }> = [];
  for (const target of targets) {
    // Descadastro pode acontecer no meio de uma cadência — reconfirma em
    // tempo de envio, defesa extra além da checagem já feita no enroll.
    if (await estaOptOutEmail(sb, target.email, campanha.user_id)) {
      await sb.from("email_targets").update({ status: "removido", atualizado_em: new Date().toISOString() }).eq("id", target.id);
      continue;
    }

    const ordemAtual = etapaAtualOrdem(target, etapas);
    const step = proximaEtapaEmail(etapas, ordemAtual);
    if (!step) {
      await sb.from("email_targets").update({ status: "concluido", atualizado_em: new Date().toISOString() }).eq("id", target.id);
      continue;
    }

    const leadSnapshot = target.lead_snapshot as Record<string, unknown>;
    const assunto = renderizarMensagemEmail(step.assunto, leadSnapshot);
    const corpo = renderizarMensagemEmail(step.corpo, leadSnapshot);
    envios.push({
      target, step,
      envio: { from, to: target.email, replyTo: sender.reply_to || undefined, subject: assunto, text: corpo, html: textoParaHtml(corpo) },
    });
  }

  if (!envios.length) return;

  try {
    const resultados = await enviarLoteEmails(envios.map((e) => e.envio));
    for (let i = 0; i < envios.length; i++) {
      const { target, step, envio } = envios[i];
      const providerMessageId = resultados[i]?.id || "";
      await marcarEnviadoEmail(sb, target, campanha.id, step, etapas, providerMessageId, envio.subject, envio.text);
    }
  } catch (e) {
    log(`Falha ao enviar lote (campanha=${campanha.id}, ${envios.length} alvo(s)): ${(e as Error).message}`);
    for (const { target, step, envio } of envios) {
      await marcarFalhaEmail(sb, target, campanha.id, step, (e as Error).message, envio.subject, envio.text);
    }
  }

  await liberarProximoEnvioSender(sb, sender.id, campanha.intervalo_min_seg, campanha.intervalo_max_seg);
}

async function processarSheetWatcher(sb: SupabaseClient, campanha: EmailCampaignRow, log: (msg: string) => void) {
  const watcher = await obterSheetWatcherEmail(sb, campanha.id);
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

  const idxEmail = cabecalho.indexOf(watcher.coluna_email);
  if (idxEmail < 0) {
    log(`Campanha ${campanha.id} (sheet_watch): coluna de e-mail '${watcher.coluna_email}' não existe mais no cabeçalho.`);
    return;
  }
  const idxNome = watcher.coluna_nome ? cabecalho.indexOf(watcher.coluna_nome) : -1;

  const leads = novas.map((linha) => {
    const lead: Record<string, unknown> = {};
    cabecalho.forEach((col, i) => { lead[col] = linha[i] ?? ""; });
    lead.email = linha[idxEmail] ?? "";
    lead.nome = idxNome >= 0 ? linha[idxNome] ?? "" : "";
    return lead;
  });

  const resultado = await enrollEmailTargets(sb, campanha.id, leads);
  await atualizarSheetWatcherEmail(sb, watcher.id, { ultima_linha_processada: linhas.length });
  log(`Campanha ${campanha.id} (sheet_watch): ${novas.length} linha(s) nova(s), ${resultado.inscritos} inscrita(s).`);
}

async function processarAutoTrigger(sb: SupabaseClient, campanha: EmailCampaignRow, log: (msg: string) => void) {
  const leads = await buscarLeadsFiltro(
    sb, campanha.user_id, campanha.filtro_nicho || "", campanha.filtro_subnicho || "",
    campanha.filtro_uf || "", campanha.ultimo_trigger_em,
  );
  const agoraIso = new Date().toISOString();
  if (!leads.length) {
    await atualizarCampanhaEmail(sb, campanha.id, { ultimo_trigger_em: agoraIso });
    return;
  }
  const resultado = await enrollEmailTargets(sb, campanha.id, leads);
  await atualizarCampanhaEmail(sb, campanha.id, { ultimo_trigger_em: agoraIso });
  log(`Campanha ${campanha.id} (auto_trigger): ${leads.length} lead(s) novo(s), ${resultado.inscritos} inscrito(s).`);
}

/** Fila de envio por e-mail — roda a cada EMAIL_DISPATCH_TICK_MS. */
export async function tickEmailDispatch(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  await requeueTravadosEmail(sb);
  const campanhas = await listarCampanhasEmailAtivas(sb);
  for (const campanha of campanhas) {
    try {
      await processarCampanha(sb, campanha, log);
    } catch (e) {
      log(`Erro processando campanha ${campanha.id}: ${(e as Error).message}`);
    }
  }
}

/** Scan lento de sheet_watch + auto_trigger de e-mail — roda a cada EMAIL_SHEET_WATCH_TICK_MS. */
export async function tickEmailSheetWatchAndAutoTrigger(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  for (const campanha of await listarCampanhasEmailSheetWatchAtivas(sb)) {
    try {
      await processarSheetWatcher(sb, campanha, log);
    } catch (e) {
      log(`Erro processando sheet_watch da campanha ${campanha.id}: ${(e as Error).message}`);
    }
  }
  for (const campanha of await listarCampanhasEmailAutoTriggerAtivas(sb)) {
    try {
      await processarAutoTrigger(sb, campanha, log);
    } catch (e) {
      log(`Erro processando auto_trigger da campanha ${campanha.id}: ${(e as Error).message}`);
    }
  }
}
