import type { SupabaseClient } from "@supabase/supabase-js";
import { validarEmail } from "@/lib/email";
import { getProfile } from "@/lib/credits";
import { buscarLeadsFiltro } from "@/lib/dispatch-db";
import type {
  EmailSenderRow, EmailCampaignRow, EmailTemplateRow, EmailCadenceStepRow, EmailTargetRow,
  EmailSheetWatcherRow, CampaignOrigem, Profile,
} from "@/lib/database.types";

// CRUD do disparo por e-mail — espelha src/lib/dispatch-db.ts (disparo
// WhatsApp) o mais fielmente possível; ver comentário de topo de
// supabase/migrations/0008_email_dispatch.sql pras diferenças
// deliberadas entre os dois canais. Mesmo padrão de cliente
// parametrizado: rotas de API passam o cliente autenticado do usuário
// (RLS), o worker passa o cliente admin.

/** Perfil só se `email_disparo_habilitado` (ou admin) — gate usado por toda rota de API do disparo por e-mail que cria/altera dados. */
export async function perfilComEmailDisparoHabilitado(sb: SupabaseClient, userId: string): Promise<Profile | null> {
  const profile = await getProfile(sb, userId);
  if (!profile) return null;
  if (!profile.email_disparo_habilitado && profile.role !== "admin") return null;
  return profile;
}

/**
 * Confirma que um remetente pertence de fato ao usuário (ou que ele é
 * admin) antes de deixar uma campanha/template referenciá-lo — mesma
 * checagem de IDOR já corrigida pro `instanceId` do disparo WhatsApp (RLS
 * só garante que a NOVA linha tem `user_id = auth.uid()`, não que os IDs
 * referenciados nela também sejam do mesmo dono).
 */
export async function senderPertenceAoUsuario(sb: SupabaseClient, senderId: string, profile: Profile): Promise<boolean> {
  const sender = await obterSender(sb, senderId);
  if (!sender) return false;
  return profile.role === "admin" || sender.user_id === profile.id;
}

// ── Remetentes ─────────────────────────────────────────────────────────────

export async function criarSender(
  sb: SupabaseClient,
  userId: string,
  params: { nome: string; fromName: string; fromEmail: string; replyTo?: string; limiteDiarioEnvios?: number | null },
) {
  const { data } = await sb
    .from("email_senders")
    .insert({
      user_id: userId, nome: params.nome, from_name: params.fromName, from_email: params.fromEmail,
      reply_to: params.replyTo || null, limite_diario_envios: params.limiteDiarioEnvios ?? null,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function atualizarSender(sb: SupabaseClient, senderId: string, campos: Partial<EmailSenderRow>) {
  const { error } = await sb.from("email_senders").update(campos).eq("id", senderId);
  return !error;
}

export async function listarSenders(sb: SupabaseClient, userId: string): Promise<EmailSenderRow[]> {
  const { data } = await sb.from("email_senders").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as EmailSenderRow[]) || [];
}

export async function obterSender(sb: SupabaseClient, senderId: string): Promise<EmailSenderRow | null> {
  const { data } = await sb.from("email_senders").select("*").eq("id", senderId).single();
  return (data as EmailSenderRow) || null;
}

/** Todos os remetentes ativos de todos os usuários — usado pelo worker de disparo. */
export async function listarSendersAtivos(sb: SupabaseClient): Promise<EmailSenderRow[]> {
  const { data } = await sb.from("email_senders").select("*").eq("ativo", true);
  return (data as EmailSenderRow[]) || [];
}

/** Conta envios com sucesso feitos por esse remetente desde a meia-noite — mesmo padrão de contarEnviosHojeInstancia. */
export async function contarEnviosHojeSender(sb: SupabaseClient, senderId: string): Promise<number> {
  const { data: campanhas } = await sb.from("email_campaigns").select("id").eq("sender_id", senderId);
  const idsCampanhas = (campanhas || []).map((c) => c.id as string);
  if (!idsCampanhas.length) return 0;

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const { count } = await sb
    .from("email_messages_log")
    .select("id", { count: "exact", head: true })
    .in("campaign_id", idsCampanhas)
    .eq("status", "sucesso")
    .gte("enviado_em", inicioDoDia.toISOString());
  return count || 0;
}

export async function deletarSender(sb: SupabaseClient, senderId: string) {
  const { error } = await sb.from("email_senders").delete().eq("id", senderId);
  return !error;
}

// ── Campanhas ────────────────────────────────────────────────────────────────

export async function criarCampanhaEmail(
  sb: SupabaseClient,
  userId: string,
  params: {
    nome: string; senderId: string; tipoOrigem: CampaignOrigem; origemSearchId?: string | null;
    filtroNicho?: string; filtroSubnicho?: string; filtroUf?: string;
    intervaloMinSeg?: number; intervaloMaxSeg?: number;
  },
) {
  const { data } = await sb
    .from("email_campaigns")
    .insert({
      user_id: userId, nome: params.nome, sender_id: params.senderId, tipo_origem: params.tipoOrigem,
      origem_search_id: params.origemSearchId || null,
      filtro_nicho: params.filtroNicho || null, filtro_subnicho: params.filtroSubnicho || null, filtro_uf: params.filtroUf || null,
      intervalo_min_seg: params.intervaloMinSeg ?? 5, intervalo_max_seg: params.intervaloMaxSeg ?? 15,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function atualizarCampanhaEmail(sb: SupabaseClient, campaignId: string, campos: Partial<EmailCampaignRow>) {
  const { error } = await sb.from("email_campaigns").update(campos).eq("id", campaignId);
  return !error;
}

export async function listarCampanhasEmail(sb: SupabaseClient, userId: string): Promise<EmailCampaignRow[]> {
  const { data } = await sb.from("email_campaigns").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as EmailCampaignRow[]) || [];
}

export async function obterCampanhaEmail(sb: SupabaseClient, campaignId: string): Promise<EmailCampaignRow | null> {
  const { data } = await sb.from("email_campaigns").select("*").eq("id", campaignId).single();
  return (data as EmailCampaignRow) || null;
}

export async function listarCampanhasEmailAtivas(sb: SupabaseClient): Promise<EmailCampaignRow[]> {
  const { data } = await sb.from("email_campaigns").select("*").eq("status", "ativa");
  return (data as EmailCampaignRow[]) || [];
}

export async function deletarCampanhaEmail(sb: SupabaseClient, campaignId: string) {
  const { error } = await sb.from("email_campaigns").delete().eq("id", campaignId);
  return !error;
}

// ── Monitoramento de Planilha Google (sheet_watch) ────────────────────────

export async function criarSheetWatcherEmail(
  sb: SupabaseClient,
  campaignId: string,
  params: { sheetId: string; abaNome: string; colunaEmail: string; colunaNome?: string; ultimaLinhaProcessada?: number },
) {
  const { data } = await sb
    .from("email_sheet_watchers")
    .insert({
      campaign_id: campaignId, sheet_id: params.sheetId, aba_nome: params.abaNome,
      coluna_email: params.colunaEmail, coluna_nome: params.colunaNome || null,
      ultima_linha_processada: params.ultimaLinhaProcessada ?? 0,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function obterSheetWatcherEmail(sb: SupabaseClient, campaignId: string): Promise<EmailSheetWatcherRow | null> {
  const { data } = await sb.from("email_sheet_watchers").select("*").eq("campaign_id", campaignId).limit(1);
  return (data?.[0] as EmailSheetWatcherRow) || null;
}

export async function atualizarSheetWatcherEmail(sb: SupabaseClient, watcherId: string, campos: Partial<EmailSheetWatcherRow>) {
  const { error } = await sb.from("email_sheet_watchers").update(campos).eq("id", watcherId);
  return !error;
}

export async function listarCampanhasEmailSheetWatchAtivas(sb: SupabaseClient): Promise<EmailCampaignRow[]> {
  const { data } = await sb.from("email_campaigns").select("*").eq("status", "ativa").eq("tipo_origem", "sheet_watch");
  return (data as EmailCampaignRow[]) || [];
}

export async function listarCampanhasEmailAutoTriggerAtivas(sb: SupabaseClient): Promise<EmailCampaignRow[]> {
  const { data } = await sb.from("email_campaigns").select("*").eq("status", "ativa").eq("tipo_origem", "auto_trigger");
  return (data as EmailCampaignRow[]) || [];
}

// `buscarLeadsFiltro` (gatilho auto_trigger) já é genérico — seleciona
// `email` junto com `telefone` — reaproveitado direto de dispatch-db.ts,
// sem duplicar.
export { buscarLeadsFiltro };

// ── Templates ──────────────────────────────────────────────────────────────

export async function criarTemplateEmail(sb: SupabaseClient, userId: string, params: { nome: string; assunto: string; corpo: string }) {
  const { data } = await sb
    .from("email_templates")
    .insert({ user_id: userId, nome: params.nome, assunto: params.assunto, corpo: params.corpo })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function listarTemplatesEmail(sb: SupabaseClient, userId: string): Promise<EmailTemplateRow[]> {
  const { data } = await sb.from("email_templates").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as EmailTemplateRow[]) || [];
}

export async function obterTemplateEmail(sb: SupabaseClient, templateId: string): Promise<EmailTemplateRow | null> {
  const { data } = await sb.from("email_templates").select("*").eq("id", templateId).single();
  return (data as EmailTemplateRow) || null;
}

export async function atualizarTemplateEmail(sb: SupabaseClient, templateId: string, campos: Partial<EmailTemplateRow>) {
  const { error } = await sb.from("email_templates").update(campos).eq("id", templateId);
  return !error;
}

export async function deletarTemplateEmail(sb: SupabaseClient, templateId: string) {
  const { error } = await sb.from("email_templates").delete().eq("id", templateId);
  return !error;
}

// ── Etapas da cadência ────────────────────────────────────────────────────────

export async function criarEtapaEmail(
  sb: SupabaseClient,
  campaignId: string,
  params: { ordem: number; atrasoHoras: number; assunto: string; corpo: string; templateId?: string },
) {
  const { data } = await sb
    .from("email_cadence_steps")
    .insert({
      campaign_id: campaignId, ordem: params.ordem, atraso_horas: params.atrasoHoras,
      assunto: params.assunto, corpo: params.corpo, template_id: params.templateId || null,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function listarEtapasEmail(sb: SupabaseClient, campaignId: string): Promise<EmailCadenceStepRow[]> {
  const { data } = await sb.from("email_cadence_steps").select("*").eq("campaign_id", campaignId).order("ordem");
  return (data as EmailCadenceStepRow[]) || [];
}

export async function deletarEtapaEmail(sb: SupabaseClient, stepId: string) {
  const { error } = await sb.from("email_cadence_steps").delete().eq("id", stepId);
  return !error;
}

export function proximaEtapaEmail(etapas: EmailCadenceStepRow[], currentStepOrdem: number): EmailCadenceStepRow | null {
  return etapas.find((e) => e.ordem > currentStepOrdem) || null;
}

// ── Opt-out ────────────────────────────────────────────────────────────────

export async function estaOptOutEmail(sb: SupabaseClient, email: string, userId: string): Promise<boolean> {
  const { data } = await sb.from("email_opt_outs").select("email").eq("email", email).eq("user_id", userId).limit(1);
  return Boolean(data?.length);
}

export async function registrarOptOutEmail(sb: SupabaseClient, email: string, userId: string, motivo = "") {
  const { error } = await sb.from("email_opt_outs").upsert(
    { email, user_id: userId, motivo: motivo || null },
    { onConflict: "email,user_id" },
  );
  return !error;
}

// ── Alvos (targets) ───────────────────────────────────────────────────────────

export interface LeadParaEnrollEmail {
  nome?: string | null;
  email?: string | null;
}

export interface EnrollResultadoEmail {
  inscritos: number;
  invalidos: number;
  duplicados: number;
  opt_out: number;
}

/**
 * Inscreve leads numa campanha de e-mail. Valida/normaliza o e-mail,
 * ignora quem estiver em opt-out, ignora duplicata (mesmo e-mail já
 * inscrito nesta campanha — a constraint UNIQUE(campaign_id, email) é a
 * rede de segurança real). Mirror de enrollTargets (dispatch-db.ts).
 */
export async function enrollEmailTargets(sb: SupabaseClient, campaignId: string, leads: LeadParaEnrollEmail[]): Promise<EnrollResultadoEmail> {
  const vazio: EnrollResultadoEmail = { inscritos: 0, invalidos: 0, duplicados: 0, opt_out: 0 };

  const campanha = await obterCampanhaEmail(sb, campaignId);
  if (!campanha) return vazio;
  const donoUserId = campanha.user_id;

  const etapas = await listarEtapasEmail(sb, campaignId);
  if (!etapas.length) return vazio;
  const primeira = etapas[0];
  const proximaEm = new Date(Date.now() + Number(primeira.atraso_horas || 0) * 3_600_000).toISOString();

  const porEmail = new Map<string, LeadParaEnrollEmail>();
  let invalidos = 0;
  let duplicadosLote = 0;
  for (const lead of leads) {
    const email = validarEmail(String(lead.email || ""));
    if (!email) {
      invalidos += 1;
      continue;
    }
    if (porEmail.has(email)) {
      duplicadosLote += 1;
      continue;
    }
    porEmail.set(email, lead);
  }

  if (!porEmail.size) return { inscritos: 0, invalidos, duplicados: duplicadosLote, opt_out: 0 };

  const optOuts = new Set<string>();
  const todosEmails = Array.from(porEmail.keys());
  for (let i = 0; i < todosEmails.length; i += 500) {
    const { data } = await sb
      .from("email_opt_outs")
      .select("email")
      .eq("user_id", donoUserId)
      .in("email", todosEmails.slice(i, i + 500));
    for (const r of data || []) optOuts.add(r.email as string);
  }

  let optOutCount = 0;
  const linhas: Array<Record<string, unknown>> = [];
  for (const [email, lead] of porEmail) {
    if (optOuts.has(email)) {
      optOutCount += 1;
      continue;
    }
    linhas.push({
      campaign_id: campaignId,
      nome: String(lead.nome || ""),
      email,
      lead_snapshot: lead,
      status: "pendente",
      current_step_id: null,
      proxima_etapa_em: proximaEm,
    });
  }

  if (!linhas.length) return { inscritos: 0, invalidos, duplicados: duplicadosLote, opt_out: optOutCount };

  let inscritos = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const { data } = await sb
      .from("email_targets")
      .upsert(linhas.slice(i, i + 500), { onConflict: "campaign_id,email", ignoreDuplicates: true })
      .select("id");
    inscritos += data?.length || 0;
  }

  const duplicadosDb = Math.max(0, linhas.length - inscritos);
  return { inscritos, invalidos, duplicados: duplicadosLote + duplicadosDb, opt_out: optOutCount };
}

export async function listarTargetsCampanhaEmail(sb: SupabaseClient, campaignId: string): Promise<EmailTargetRow[]> {
  const { data } = await sb.from("email_targets").select("*").eq("campaign_id", campaignId).order("criado_em", { ascending: false });
  return (data as EmailTargetRow[]) || [];
}

export async function statsCampanhaEmail(sb: SupabaseClient, campaignId: string) {
  const targets = await listarTargetsCampanhaEmail(sb, campaignId);
  const stats: Record<string, number> = { total: targets.length, pendente: 0, enviando: 0, enviado: 0, concluido: 0, falhou: 0, removido: 0 };
  for (const t of targets) stats[t.status] = (stats[t.status] || 0) + 1;
  return stats;
}

// ── Fila de disparo (usada pelo worker) ────────────────────────────────────

export async function atualizarTargetEmail(sb: SupabaseClient, targetId: string, campos: Partial<EmailTargetRow>) {
  const { error } = await sb.from("email_targets").update(campos).eq("id", targetId);
  return !error;
}

/** Reivindica atomicamente até `limit` alvos prontos pra envio de uma campanha (RPC claim_email_targets) — em lote, ao contrário de claimTargetParaInstancia (1 por instância). */
export async function claimEmailTargets(sb: SupabaseClient, campaignId: string, limit = 20): Promise<EmailTargetRow[]> {
  const { data } = await sb.rpc("claim_email_targets", { p_campaign_id: campaignId, p_limit: limit });
  return (data as EmailTargetRow[]) || [];
}

export async function marcarEnviadoEmail(
  sb: SupabaseClient,
  target: EmailTargetRow,
  campaignId: string,
  step: EmailCadenceStepRow,
  etapas: EmailCadenceStepRow[],
  providerMessageId: string,
  assuntoEnviado: string,
  corpoEnviado: string,
) {
  const prox = proximaEtapaEmail(etapas, step.ordem);
  const agora = new Date();
  if (prox) {
    const atraso = Number(prox.atraso_horas || 0) * 3_600_000;
    await sb.from("email_targets").update({
      status: "pendente", current_step_id: step.id,
      proxima_etapa_em: new Date(agora.getTime() + atraso).toISOString(),
      atualizado_em: agora.toISOString(),
    }).eq("id", target.id);
  } else {
    await sb.from("email_targets").update({
      status: "concluido", current_step_id: step.id, atualizado_em: agora.toISOString(),
    }).eq("id", target.id);
  }

  await sb.from("email_messages_log").insert({
    target_id: target.id, campaign_id: campaignId, step_id: step.id,
    status: "sucesso", provider_message_id: providerMessageId, assunto_enviado: assuntoEnviado, corpo_enviado: corpoEnviado,
  });
}

export async function marcarFalhaEmail(
  sb: SupabaseClient, target: EmailTargetRow, campaignId: string, step: EmailCadenceStepRow | null, erroMsg: string,
  assuntoEnviado = "", corpoEnviado = "",
) {
  await sb.from("email_targets").update({ status: "falhou", atualizado_em: new Date().toISOString() }).eq("id", target.id);
  await sb.from("email_messages_log").insert({
    target_id: target.id, campaign_id: campaignId, step_id: step?.id || null,
    status: "erro", erro_msg: String(erroMsg).slice(0, 500), assunto_enviado: assuntoEnviado, corpo_enviado: corpoEnviado,
  });
}

/** Recupera alvos travados em 'enviando' há mais de `minutos` (crash mid-send) — entrega é 'pelo menos uma vez'. */
export async function requeueTravadosEmail(sb: SupabaseClient, minutos = 5): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60_000).toISOString();
  const { data } = await sb.from("email_targets").update({ status: "pendente" }).eq("status", "enviando").lt("reservado_em", limite).select("id");
  return data?.length || 0;
}

/** Após um lote de envio, sorteia e grava quando o remetente pode enviar de novo (pacing entre LOTES — ver comentário no topo da migration). */
export async function liberarProximoEnvioSender(sb: SupabaseClient, senderId: string, intervaloMinSeg: number, intervaloMaxSeg: number) {
  const agora = new Date();
  const min = Math.max(1, Math.floor(intervaloMinSeg));
  const max = Math.max(min, Math.floor(intervaloMaxSeg));
  const delaySeg = min + Math.floor(Math.random() * (max - min + 1));
  await sb.from("email_senders").update({
    ultimo_envio_em: agora.toISOString(),
    proximo_envio_liberado_em: new Date(agora.getTime() + delaySeg * 1000).toISOString(),
  }).eq("id", senderId);
}
