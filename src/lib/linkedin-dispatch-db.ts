import type { SupabaseClient } from "@supabase/supabase-js";
import { validarLinkedInUrl } from "@/lib/linkedin-url";
import { getProfile } from "@/lib/credits";
import { buscarLeadsFiltro } from "@/lib/dispatch-db";
import type {
  LinkedinAccountRow, LinkedinCampaignRow, LinkedinTemplateRow, LinkedinCadenceStepRow, LinkedinTargetRow,
  LinkedinSheetWatcherRow, LinkedinStepTipo, CampaignOrigem, Profile,
} from "@/lib/database.types";

// CRUD do disparo por LinkedIn — espelha src/lib/email-dispatch-db.ts
// (disparo por e-mail) o mais fielmente possível; ver comentário de topo
// de supabase/migrations/0009_linkedin_dispatch.sql pras diferenças
// deliberadas entre os canais. Mesmo padrão de cliente parametrizado:
// rotas de API passam o cliente autenticado do usuário (RLS), o worker
// passa o cliente admin.

/** Perfil só se `linkedin_disparo_habilitado` (ou admin) — gate usado por toda rota de API do disparo por LinkedIn que cria/altera dados. */
export async function perfilComLinkedinDisparoHabilitado(sb: SupabaseClient, userId: string): Promise<Profile | null> {
  const profile = await getProfile(sb, userId);
  if (!profile) return null;
  if (profile.role === "admin") return profile;
  if (!profile.linkedin_disparo_habilitado || profile.conta_teste) return null;
  return profile;
}

/**
 * Confirma que uma conta LinkedIn pertence de fato ao usuário (ou que ele
 * é admin) antes de deixar uma campanha/template referenciá-la — mesma
 * checagem de IDOR já corrigida pro `instanceId`/`senderId` dos outros
 * canais.
 */
export async function contaPertenceAoUsuario(sb: SupabaseClient, accountId: string, profile: Profile): Promise<boolean> {
  const conta = await obterConta(sb, accountId);
  if (!conta) return false;
  return profile.role === "admin" || conta.user_id === profile.id;
}

// ── Contas ─────────────────────────────────────────────────────────────────

export async function criarConta(sb: SupabaseClient, userId: string, nome: string) {
  const { data } = await sb
    .from("linkedin_accounts")
    .insert({ user_id: userId, nome, status: "conectando" })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function atualizarConta(sb: SupabaseClient, accountId: string, campos: Partial<LinkedinAccountRow>) {
  const { error } = await sb.from("linkedin_accounts").update(campos).eq("id", accountId);
  return !error;
}

export async function listarContas(sb: SupabaseClient, userId: string): Promise<LinkedinAccountRow[]> {
  const { data } = await sb.from("linkedin_accounts").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as LinkedinAccountRow[]) || [];
}

export async function obterConta(sb: SupabaseClient, accountId: string): Promise<LinkedinAccountRow | null> {
  const { data } = await sb.from("linkedin_accounts").select("*").eq("id", accountId).single();
  return (data as LinkedinAccountRow) || null;
}

/** Todas as contas conectadas de todos os usuários — usado pelo worker de disparo. */
export async function listarContasConectadas(sb: SupabaseClient): Promise<LinkedinAccountRow[]> {
  const { data } = await sb.from("linkedin_accounts").select("*").eq("status", "conectado");
  return (data as LinkedinAccountRow[]) || [];
}

/** Busca uma conta pelo unipile_account_id — usado pelo handler do webhook (que não conhece nosso id interno). */
export async function obterContaPorUnipileId(sb: SupabaseClient, unipileAccountId: string): Promise<LinkedinAccountRow | null> {
  const { data } = await sb.from("linkedin_accounts").select("*").eq("unipile_account_id", unipileAccountId).single();
  return (data as LinkedinAccountRow) || null;
}

async function contarAcoesHojeConta(sb: SupabaseClient, accountId: string, tipoAcao: LinkedinStepTipo): Promise<number> {
  const { data: campanhas } = await sb.from("linkedin_campaigns").select("id").eq("account_id", accountId);
  const idsCampanhas = (campanhas || []).map((c) => c.id as string);
  if (!idsCampanhas.length) return 0;

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const { count } = await sb
    .from("linkedin_messages_log")
    .select("id", { count: "exact", head: true })
    .in("campaign_id", idsCampanhas)
    .eq("status", "sucesso")
    .eq("tipo_acao", tipoAcao)
    .gte("enviado_em", inicioDoDia.toISOString());
  return count || 0;
}

export async function contarConvitesHojeConta(sb: SupabaseClient, accountId: string): Promise<number> {
  return contarAcoesHojeConta(sb, accountId, "convite");
}

export async function contarMensagensHojeConta(sb: SupabaseClient, accountId: string): Promise<number> {
  return contarAcoesHojeConta(sb, accountId, "mensagem");
}

export async function deletarConta(sb: SupabaseClient, accountId: string) {
  const { error } = await sb.from("linkedin_accounts").delete().eq("id", accountId);
  return !error;
}

// ── Campanhas ────────────────────────────────────────────────────────────────

export async function criarCampanhaLinkedin(
  sb: SupabaseClient,
  userId: string,
  params: {
    nome: string; accountId: string; tipoOrigem: CampaignOrigem; origemSearchId?: string | null;
    filtroNicho?: string; filtroSubnicho?: string; filtroUf?: string;
    intervaloMinSeg?: number; intervaloMaxSeg?: number;
  },
) {
  const { data } = await sb
    .from("linkedin_campaigns")
    .insert({
      user_id: userId, nome: params.nome, account_id: params.accountId, tipo_origem: params.tipoOrigem,
      origem_search_id: params.origemSearchId || null,
      filtro_nicho: params.filtroNicho || null, filtro_subnicho: params.filtroSubnicho || null, filtro_uf: params.filtroUf || null,
      intervalo_min_seg: params.intervaloMinSeg ?? 180, intervalo_max_seg: params.intervaloMaxSeg ?? 600,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function atualizarCampanhaLinkedin(sb: SupabaseClient, campaignId: string, campos: Partial<LinkedinCampaignRow>) {
  const { error } = await sb.from("linkedin_campaigns").update(campos).eq("id", campaignId);
  return !error;
}

export async function listarCampanhasLinkedin(sb: SupabaseClient, userId: string): Promise<LinkedinCampaignRow[]> {
  const { data } = await sb.from("linkedin_campaigns").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as LinkedinCampaignRow[]) || [];
}

export async function obterCampanhaLinkedin(sb: SupabaseClient, campaignId: string): Promise<LinkedinCampaignRow | null> {
  const { data } = await sb.from("linkedin_campaigns").select("*").eq("id", campaignId).single();
  return (data as LinkedinCampaignRow) || null;
}

export async function listarCampanhasLinkedinAtivas(sb: SupabaseClient): Promise<LinkedinCampaignRow[]> {
  const { data } = await sb.from("linkedin_campaigns").select("*").eq("status", "ativa");
  return (data as LinkedinCampaignRow[]) || [];
}

export async function deletarCampanhaLinkedin(sb: SupabaseClient, campaignId: string) {
  const { error } = await sb.from("linkedin_campaigns").delete().eq("id", campaignId);
  return !error;
}

// ── Monitoramento de Planilha Google (sheet_watch) ────────────────────────

export async function criarSheetWatcherLinkedin(
  sb: SupabaseClient,
  campaignId: string,
  params: { sheetId: string; abaNome: string; colunaUrl: string; colunaNome?: string; ultimaLinhaProcessada?: number },
) {
  const { data } = await sb
    .from("linkedin_sheet_watchers")
    .insert({
      campaign_id: campaignId, sheet_id: params.sheetId, aba_nome: params.abaNome,
      coluna_url: params.colunaUrl, coluna_nome: params.colunaNome || null,
      ultima_linha_processada: params.ultimaLinhaProcessada ?? 0,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function obterSheetWatcherLinkedin(sb: SupabaseClient, campaignId: string): Promise<LinkedinSheetWatcherRow | null> {
  const { data } = await sb.from("linkedin_sheet_watchers").select("*").eq("campaign_id", campaignId).limit(1);
  return (data?.[0] as LinkedinSheetWatcherRow) || null;
}

export async function atualizarSheetWatcherLinkedin(sb: SupabaseClient, watcherId: string, campos: Partial<LinkedinSheetWatcherRow>) {
  const { error } = await sb.from("linkedin_sheet_watchers").update(campos).eq("id", watcherId);
  return !error;
}

export async function listarCampanhasLinkedinSheetWatchAtivas(sb: SupabaseClient): Promise<LinkedinCampaignRow[]> {
  const { data } = await sb.from("linkedin_campaigns").select("*").eq("status", "ativa").eq("tipo_origem", "sheet_watch");
  return (data as LinkedinCampaignRow[]) || [];
}

export async function listarCampanhasLinkedinAutoTriggerAtivas(sb: SupabaseClient): Promise<LinkedinCampaignRow[]> {
  const { data } = await sb.from("linkedin_campaigns").select("*").eq("status", "ativa").eq("tipo_origem", "auto_trigger");
  return (data as LinkedinCampaignRow[]) || [];
}

// `buscarLeadsFiltro` (gatilho auto_trigger) já é genérico — reaproveitado
// direto de dispatch-db.ts. Filtro por linkedin_url não nulo é feito no
// próprio enrollLinkedInTargets (validarLinkedInUrl descarta o resto).
export { buscarLeadsFiltro };

// ── Templates ──────────────────────────────────────────────────────────────

export async function criarTemplateLinkedin(sb: SupabaseClient, userId: string, params: { nome: string; corpo: string }) {
  const { data } = await sb
    .from("linkedin_templates")
    .insert({ user_id: userId, nome: params.nome, corpo: params.corpo })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function listarTemplatesLinkedin(sb: SupabaseClient, userId: string): Promise<LinkedinTemplateRow[]> {
  const { data } = await sb.from("linkedin_templates").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as LinkedinTemplateRow[]) || [];
}

export async function obterTemplateLinkedin(sb: SupabaseClient, templateId: string): Promise<LinkedinTemplateRow | null> {
  const { data } = await sb.from("linkedin_templates").select("*").eq("id", templateId).single();
  return (data as LinkedinTemplateRow) || null;
}

export async function atualizarTemplateLinkedin(sb: SupabaseClient, templateId: string, campos: Partial<LinkedinTemplateRow>) {
  const { error } = await sb.from("linkedin_templates").update(campos).eq("id", templateId);
  return !error;
}

export async function deletarTemplateLinkedin(sb: SupabaseClient, templateId: string) {
  const { error } = await sb.from("linkedin_templates").delete().eq("id", templateId);
  return !error;
}

// ── Etapas da cadência ────────────────────────────────────────────────────────

export async function criarEtapaLinkedin(
  sb: SupabaseClient,
  campaignId: string,
  params: { ordem: number; atrasoHoras: number; tipo: LinkedinStepTipo; nota?: string; corpo?: string; templateId?: string },
) {
  const { data } = await sb
    .from("linkedin_cadence_steps")
    .insert({
      campaign_id: campaignId, ordem: params.ordem, atraso_horas: params.atrasoHoras, tipo: params.tipo,
      nota: params.nota || null, corpo: params.corpo || null, template_id: params.templateId || null,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function listarEtapasLinkedin(sb: SupabaseClient, campaignId: string): Promise<LinkedinCadenceStepRow[]> {
  const { data } = await sb.from("linkedin_cadence_steps").select("*").eq("campaign_id", campaignId).order("ordem");
  return (data as LinkedinCadenceStepRow[]) || [];
}

export async function deletarEtapaLinkedin(sb: SupabaseClient, stepId: string) {
  const { error } = await sb.from("linkedin_cadence_steps").delete().eq("id", stepId);
  return !error;
}

export function proximaEtapaLinkedin(etapas: LinkedinCadenceStepRow[], currentStepOrdem: number): LinkedinCadenceStepRow | null {
  return etapas.find((e) => e.ordem > currentStepOrdem) || null;
}

// ── Opt-out ────────────────────────────────────────────────────────────────

export async function estaOptOutLinkedin(sb: SupabaseClient, linkedinUrl: string, userId: string): Promise<boolean> {
  const { data } = await sb.from("linkedin_opt_outs").select("linkedin_url").eq("linkedin_url", linkedinUrl).eq("user_id", userId).limit(1);
  return Boolean(data?.length);
}

export async function registrarOptOutLinkedin(sb: SupabaseClient, linkedinUrl: string, userId: string, motivo = "") {
  const { error } = await sb.from("linkedin_opt_outs").upsert(
    { linkedin_url: linkedinUrl, user_id: userId, motivo: motivo || null },
    { onConflict: "linkedin_url,user_id" },
  );
  return !error;
}

// ── Alvos (targets) ───────────────────────────────────────────────────────────

export interface LeadParaEnrollLinkedin {
  nome?: string | null;
  linkedin_url?: string | null;
}

export interface EnrollResultadoLinkedin {
  inscritos: number;
  invalidos: number;
  duplicados: number;
  opt_out: number;
}

/**
 * Inscreve leads numa campanha de LinkedIn. Valida/normaliza a URL do
 * perfil, ignora quem estiver em opt-out, ignora duplicata (mesma URL já
 * inscrita nesta campanha — a constraint UNIQUE(campaign_id, linkedin_url)
 * é a rede de segurança real). Não resolve `provider_id` aqui — fica pro
 * worker resolver sob demanda, na primeira ação do alvo (decisão de
 * arquitetura: resolver exige saber qual conta vai agir primeiro).
 * Mirror de enrollEmailTargets.
 */
export async function enrollLinkedInTargets(sb: SupabaseClient, campaignId: string, leads: LeadParaEnrollLinkedin[]): Promise<EnrollResultadoLinkedin> {
  const vazio: EnrollResultadoLinkedin = { inscritos: 0, invalidos: 0, duplicados: 0, opt_out: 0 };

  const campanha = await obterCampanhaLinkedin(sb, campaignId);
  if (!campanha) return vazio;
  const donoUserId = campanha.user_id;

  const etapas = await listarEtapasLinkedin(sb, campaignId);
  if (!etapas.length) return vazio;
  const primeira = etapas[0];
  const proximaEm = new Date(Date.now() + Number(primeira.atraso_horas || 0) * 3_600_000).toISOString();

  const porUrl = new Map<string, LeadParaEnrollLinkedin>();
  let invalidos = 0;
  let duplicadosLote = 0;
  for (const lead of leads) {
    const url = validarLinkedInUrl(String(lead.linkedin_url || ""));
    if (!url) {
      invalidos += 1;
      continue;
    }
    if (porUrl.has(url)) {
      duplicadosLote += 1;
      continue;
    }
    porUrl.set(url, lead);
  }

  if (!porUrl.size) return { inscritos: 0, invalidos, duplicados: duplicadosLote, opt_out: 0 };

  const optOuts = new Set<string>();
  const todasUrls = Array.from(porUrl.keys());
  for (let i = 0; i < todasUrls.length; i += 500) {
    const { data } = await sb
      .from("linkedin_opt_outs")
      .select("linkedin_url")
      .eq("user_id", donoUserId)
      .in("linkedin_url", todasUrls.slice(i, i + 500));
    for (const r of data || []) optOuts.add(r.linkedin_url as string);
  }

  let optOutCount = 0;
  const linhas: Array<Record<string, unknown>> = [];
  for (const [url, lead] of porUrl) {
    if (optOuts.has(url)) {
      optOutCount += 1;
      continue;
    }
    linhas.push({
      campaign_id: campaignId,
      nome: String(lead.nome || ""),
      linkedin_url: url,
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
      .from("linkedin_targets")
      .upsert(linhas.slice(i, i + 500), { onConflict: "campaign_id,linkedin_url", ignoreDuplicates: true })
      .select("id");
    inscritos += data?.length || 0;
  }

  const duplicadosDb = Math.max(0, linhas.length - inscritos);
  return { inscritos, invalidos, duplicados: duplicadosLote + duplicadosDb, opt_out: optOutCount };
}

export async function listarTargetsCampanhaLinkedin(sb: SupabaseClient, campaignId: string): Promise<LinkedinTargetRow[]> {
  const { data } = await sb.from("linkedin_targets").select("*").eq("campaign_id", campaignId).order("criado_em", { ascending: false });
  return (data as LinkedinTargetRow[]) || [];
}

export async function statsCampanhaLinkedin(sb: SupabaseClient, campaignId: string) {
  const targets = await listarTargetsCampanhaLinkedin(sb, campaignId);
  const stats: Record<string, number> = {
    total: targets.length, pendente: 0, enviando: 0, aguardando_aceite: 0, enviado: 0, concluido: 0, falhou: 0, removido: 0,
  };
  for (const t of targets) stats[t.status] = (stats[t.status] || 0) + 1;
  return stats;
}

// ── Fila de disparo (usada pelo worker) ────────────────────────────────────

export async function atualizarTargetLinkedin(sb: SupabaseClient, targetId: string, campos: Partial<LinkedinTargetRow>) {
  const { error } = await sb.from("linkedin_targets").update(campos).eq("id", targetId);
  return !error;
}

/** Reivindica atomicamente 1 alvo pronto pra envio pra essa conta (RPC claim_linkedin_target — 1 por vez, não em lote). */
export async function claimLinkedInTarget(sb: SupabaseClient, accountId: string): Promise<LinkedinTargetRow | null> {
  const { data } = await sb.rpc("claim_linkedin_target", { p_account_id: accountId });
  const rows = (data as LinkedinTargetRow[]) || [];
  return rows[0] || null;
}

/**
 * Convite enviado com sucesso — diferente de marcarEnviadoLinkedin, NÃO
 * avança a cadência: o alvo fica preso em `aguardando_aceite` até o
 * webhook (ou o poll de reforço) confirmar que a conexão foi aceita. Só
 * então liberarAlvoAposAceite avança pra próxima etapa de verdade.
 */
export async function marcarAguardandoAceite(
  sb: SupabaseClient, target: LinkedinTargetRow, campaignId: string, step: LinkedinCadenceStepRow, providerRef: string,
) {
  await sb.from("linkedin_targets").update({
    status: "aguardando_aceite", current_step_id: step.id, atualizado_em: new Date().toISOString(),
  }).eq("id", target.id);

  await sb.from("linkedin_messages_log").insert({
    target_id: target.id, campaign_id: campaignId, step_id: step.id,
    status: "sucesso", tipo_acao: "convite", provider_ref: providerRef, corpo_enviado: step.nota || "",
  });
}

/** Mensagem enviada com sucesso — avança a cadência normalmente (mirror de marcarEnviadoEmail). */
export async function marcarEnviadoLinkedin(
  sb: SupabaseClient,
  target: LinkedinTargetRow,
  campaignId: string,
  step: LinkedinCadenceStepRow,
  etapas: LinkedinCadenceStepRow[],
  providerRef: string,
  corpoEnviado: string,
) {
  const prox = proximaEtapaLinkedin(etapas, step.ordem);
  const agora = new Date();
  if (prox) {
    const atraso = Number(prox.atraso_horas || 0) * 3_600_000;
    await sb.from("linkedin_targets").update({
      status: "pendente", current_step_id: step.id,
      proxima_etapa_em: new Date(agora.getTime() + atraso).toISOString(),
      atualizado_em: agora.toISOString(),
    }).eq("id", target.id);
  } else {
    await sb.from("linkedin_targets").update({
      status: "concluido", current_step_id: step.id, atualizado_em: agora.toISOString(),
    }).eq("id", target.id);
  }

  await sb.from("linkedin_messages_log").insert({
    target_id: target.id, campaign_id: campaignId, step_id: step.id,
    status: "sucesso", tipo_acao: "mensagem", provider_ref: providerRef, corpo_enviado: corpoEnviado,
  });
}

export async function marcarFalhaLinkedin(
  sb: SupabaseClient, target: LinkedinTargetRow, campaignId: string, step: LinkedinCadenceStepRow | null, tipoAcao: LinkedinStepTipo,
  erroMsg: string, corpoEnviado = "",
) {
  await sb.from("linkedin_targets").update({ status: "falhou", atualizado_em: new Date().toISOString() }).eq("id", target.id);
  await sb.from("linkedin_messages_log").insert({
    target_id: target.id, campaign_id: campaignId, step_id: step?.id || null,
    status: "erro", tipo_acao: tipoAcao, erro_msg: String(erroMsg).slice(0, 500), corpo_enviado: corpoEnviado,
  });
}

/**
 * Chamado pelo handler do webhook `new_relation` (e pelo poll de reforço)
 * quando um convite é confirmado como aceito — libera o alvo de
 * `aguardando_aceite` de volta pra fila normal, avançando pra próxima
 * etapa da cadência (mesma lógica de avanço de marcarEnviadoLinkedin, só
 * que disparada por um evento externo em vez de um envio).
 */
export async function liberarAlvoAposAceite(sb: SupabaseClient, target: LinkedinTargetRow): Promise<boolean> {
  if (target.status !== "aguardando_aceite") return false;

  const etapas = await listarEtapasLinkedin(sb, target.campaign_id);
  const etapaAtual = etapas.find((e) => e.id === target.current_step_id);
  const ordemAtual = etapaAtual?.ordem ?? 0;
  const prox = proximaEtapaLinkedin(etapas, ordemAtual);
  const agora = new Date();

  if (prox) {
    const atraso = Number(prox.atraso_horas || 0) * 3_600_000;
    await sb.from("linkedin_targets").update({
      status: "pendente",
      proxima_etapa_em: new Date(agora.getTime() + atraso).toISOString(),
      atualizado_em: agora.toISOString(),
    }).eq("id", target.id);
  } else {
    await sb.from("linkedin_targets").update({
      status: "concluido", atualizado_em: agora.toISOString(),
    }).eq("id", target.id);
  }
  return true;
}

/** Todos os alvos em aguardando_aceite de uma conta (todas as campanhas dela) — usado pelo poll de reforço. */
export async function listarTargetsAguardandoAceitePorConta(sb: SupabaseClient, accountId: string): Promise<LinkedinTargetRow[]> {
  const { data: campanhas } = await sb.from("linkedin_campaigns").select("id").eq("account_id", accountId);
  const idsCampanhas = (campanhas || []).map((c) => c.id as string);
  if (!idsCampanhas.length) return [];

  const { data } = await sb
    .from("linkedin_targets")
    .select("*")
    .eq("status", "aguardando_aceite")
    .not("provider_id", "is", null)
    .in("campaign_id", idsCampanhas);
  return (data as LinkedinTargetRow[]) || [];
}

/** Busca um alvo em aguardando_aceite pelo provider_id — usado pelo handler do webhook new_relation e pelo poll de reforço. */
export async function obterTargetAguardandoAceitePorProviderId(sb: SupabaseClient, accountId: string, providerId: string): Promise<LinkedinTargetRow | null> {
  const { data: campanhas } = await sb.from("linkedin_campaigns").select("id").eq("account_id", accountId);
  const idsCampanhas = (campanhas || []).map((c) => c.id as string);
  if (!idsCampanhas.length) return null;

  const { data } = await sb
    .from("linkedin_targets")
    .select("*")
    .eq("provider_id", providerId)
    .eq("status", "aguardando_aceite")
    .in("campaign_id", idsCampanhas)
    .limit(1);
  const rows = (data as LinkedinTargetRow[]) || [];
  return rows[0] || null;
}

/** Recupera alvos travados em 'enviando' há mais de `minutos` (crash mid-send) — entrega é 'pelo menos uma vez'. */
export async function requeueTravadosLinkedin(sb: SupabaseClient, minutos = 5): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60_000).toISOString();
  const { data } = await sb.from("linkedin_targets").update({ status: "pendente" }).eq("status", "enviando").lt("reservado_em", limite).select("id");
  return data?.length || 0;
}

/** Após uma ação, sorteia e grava quando a conta pode agir de novo — pacing separado por tipo de ação (convite/mensagem). */
export async function liberarProximaAcaoConta(
  sb: SupabaseClient, accountId: string, tipoAcao: LinkedinStepTipo, intervaloMinSeg: number, intervaloMaxSeg: number,
) {
  const agora = new Date();
  const min = Math.max(1, Math.floor(intervaloMinSeg));
  const max = Math.max(min, Math.floor(intervaloMaxSeg));
  const delaySeg = min + Math.floor(Math.random() * (max - min + 1));
  const proximoLiberado = new Date(agora.getTime() + delaySeg * 1000).toISOString();

  if (tipoAcao === "convite") {
    await sb.from("linkedin_accounts").update({ ultimo_convite_em: agora.toISOString(), proximo_convite_liberado_em: proximoLiberado }).eq("id", accountId);
  } else {
    await sb.from("linkedin_accounts").update({ ultima_mensagem_em: agora.toISOString(), proximo_mensagem_liberado_em: proximoLiberado }).eq("id", accountId);
  }
}
