import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarE164 } from "@/lib/phone";
import type {
  WhatsappInstanceRow, DispatchCampaignRow, CadenceStepRow, DispatchTargetRow,
  MessageTemplateRow, OficialConnectionRequestRow, InstanceCanal, CampaignOrigem,
} from "@/lib/database.types";

// CRUD do disparo WhatsApp — portado de modules/dispatch_db.py. Diferente
// do produto atual (que usava sempre o cliente service-role, "pra
// funcionar tanto na UI quanto no scheduler"), aqui o cliente é
// parametrizado: rotas de API interativas passam o cliente autenticado do
// usuário (RLS garante que só vê o que é seu ou é admin), e o worker de
// background passa o cliente admin (precisa operar entre usuários).

// ── Instâncias ─────────────────────────────────────────────────────────────

export async function criarInstancia(sb: SupabaseClient, userId: string, nome: string, evolutionInstanceName: string) {
  const { data } = await sb
    .from("whatsapp_instances")
    .insert({ user_id: userId, nome, canal: "evolution", evolution_instance_name: evolutionInstanceName, status: "conectando" })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function criarInstanciaOficial(
  sb: SupabaseClient, userId: string, nome: string, token: string, phoneNumberId: string, wabaId = "", numeroConectado = "",
) {
  const { data } = await sb
    .from("whatsapp_instances")
    .insert({
      user_id: userId, nome, canal: "oficial", token_oficial: token, phone_number_id: phoneNumberId,
      waba_id: wabaId || null, numero_conectado: numeroConectado || null, status: "conectado",
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function atualizarInstancia(sb: SupabaseClient, instanceId: string, campos: Partial<WhatsappInstanceRow>) {
  const { error } = await sb.from("whatsapp_instances").update(campos).eq("id", instanceId);
  return !error;
}

export async function listarInstancias(sb: SupabaseClient, userId: string): Promise<WhatsappInstanceRow[]> {
  const { data } = await sb.from("whatsapp_instances").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as WhatsappInstanceRow[]) || [];
}

export async function obterInstancia(sb: SupabaseClient, instanceId: string): Promise<WhatsappInstanceRow | null> {
  const { data } = await sb.from("whatsapp_instances").select("*").eq("id", instanceId).single();
  return (data as WhatsappInstanceRow) || null;
}

/** Todas as instâncias conectadas de todos os usuários — usado pelo worker de disparo. */
export async function listarInstanciasConectadas(sb: SupabaseClient): Promise<WhatsappInstanceRow[]> {
  const { data } = await sb.from("whatsapp_instances").select("*").eq("status", "conectado");
  return (data as WhatsappInstanceRow[]) || [];
}

export async function deletarInstancia(sb: SupabaseClient, instanceId: string) {
  const { error } = await sb.from("whatsapp_instances").delete().eq("id", instanceId);
  return !error;
}

// ── Solicitações de conexão do canal oficial ────────────────────────────────

export async function criarSolicitacaoOficial(sb: SupabaseClient, userId: string, nomeDesejado = "", telefoneContato = "") {
  const { data } = await sb
    .from("oficial_connection_requests")
    .insert({ user_id: userId, nome_desejado: nomeDesejado || null, telefone_contato: telefoneContato || null })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function listarSolicitacoesOficial(sb: SupabaseClient, status?: string): Promise<OficialConnectionRequestRow[]> {
  let q = sb.from("oficial_connection_requests").select("*").order("criado_em", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (data as OficialConnectionRequestRow[]) || [];
}

export async function atualizarSolicitacaoOficial(sb: SupabaseClient, reqId: string, campos: Partial<OficialConnectionRequestRow>) {
  const { error } = await sb.from("oficial_connection_requests").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", reqId);
  return !error;
}

// ── Campanhas ────────────────────────────────────────────────────────────────

export async function criarCampanha(
  sb: SupabaseClient,
  userId: string,
  params: {
    nome: string; instanceId: string; tipoOrigem: CampaignOrigem; origemSearchId?: string | null;
    filtroNicho?: string; filtroSubnicho?: string; filtroUf?: string;
    intervaloMinSeg?: number; intervaloMaxSeg?: number;
  },
) {
  const { data } = await sb
    .from("dispatch_campaigns")
    .insert({
      user_id: userId, nome: params.nome, instance_id: params.instanceId, tipo_origem: params.tipoOrigem,
      origem_search_id: params.origemSearchId || null,
      filtro_nicho: params.filtroNicho || null, filtro_subnicho: params.filtroSubnicho || null, filtro_uf: params.filtroUf || null,
      intervalo_min_seg: params.intervaloMinSeg ?? 30, intervalo_max_seg: params.intervaloMaxSeg ?? 90,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function atualizarCampanha(sb: SupabaseClient, campaignId: string, campos: Partial<DispatchCampaignRow>) {
  const { error } = await sb.from("dispatch_campaigns").update(campos).eq("id", campaignId);
  return !error;
}

export async function listarCampanhas(sb: SupabaseClient, userId: string): Promise<DispatchCampaignRow[]> {
  const { data } = await sb.from("dispatch_campaigns").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as DispatchCampaignRow[]) || [];
}

export async function obterCampanha(sb: SupabaseClient, campaignId: string): Promise<DispatchCampaignRow | null> {
  const { data } = await sb.from("dispatch_campaigns").select("*").eq("id", campaignId).single();
  return (data as DispatchCampaignRow) || null;
}

export async function listarCampanhasAtivas(sb: SupabaseClient): Promise<DispatchCampaignRow[]> {
  const { data } = await sb.from("dispatch_campaigns").select("*").eq("status", "ativa");
  return (data as DispatchCampaignRow[]) || [];
}

export async function deletarCampanha(sb: SupabaseClient, campaignId: string) {
  const { error } = await sb.from("dispatch_campaigns").delete().eq("id", campaignId);
  return !error;
}

export async function listarCampanhasSheetWatchAtivas(sb: SupabaseClient): Promise<DispatchCampaignRow[]> {
  const { data } = await sb.from("dispatch_campaigns").select("*").eq("status", "ativa").eq("tipo_origem", "sheet_watch");
  return (data as DispatchCampaignRow[]) || [];
}

export async function listarCampanhasAutoTriggerAtivas(sb: SupabaseClient): Promise<DispatchCampaignRow[]> {
  const { data } = await sb.from("dispatch_campaigns").select("*").eq("status", "ativa").eq("tipo_origem", "auto_trigger");
  return (data as DispatchCampaignRow[]) || [];
}

interface LeadFiltroRow {
  nome: string | null; telefone: string | null; telefone2: string | null; email: string | null;
  endereco: string | null; municipio: string | null; uf: string | null; cep: string | null;
  site: string | null; maps_url: string | null; avaliacao: number | null; total_avaliacoes: number | null;
  cnpj: string | null; nicho: string | null; subnicho: string | null; fonte: string | null; created_at: string;
}

/** Leads do próprio dono da campanha que batem com nicho/subnicho/UF, extraídos depois de `desde`. */
export async function buscarLeadsFiltro(
  sb: SupabaseClient, userId: string, nicho = "", subnicho = "", uf = "", desde?: string | null,
): Promise<LeadFiltroRow[]> {
  const leads: LeadFiltroRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    let q = sb
      .from("leads")
      .select("nome, telefone, telefone2, email, endereco, municipio, uf, cep, site, maps_url, avaliacao, total_avaliacoes, cnpj, nicho, subnicho, fonte, created_at")
      .eq("user_id", userId);
    if (nicho) q = q.ilike("nicho", `%${nicho}%`);
    if (subnicho) q = q.ilike("subnicho", `%${subnicho}%`);
    if (uf) q = q.eq("uf", uf.toUpperCase());
    if (desde) q = q.gt("created_at", desde);
    const { data } = await q.order("created_at").range(offset, offset + pageSize - 1);
    const linhas = (data as LeadFiltroRow[]) || [];
    leads.push(...linhas);
    if (linhas.length < pageSize) break;
    offset += pageSize;
  }
  return leads;
}

// ── Templates (canal oficial) ─────────────────────────────────────────────

export async function criarTemplateDb(
  sb: SupabaseClient,
  userId: string,
  params: {
    instanceId: string; nome: string; categoria: string; corpo: string;
    nomeMeta?: string; idioma?: string; cabecalho?: string; rodape?: string; variaveis?: string[];
  },
) {
  const componentes: Array<Record<string, unknown>> = [{ type: "BODY", text: params.corpo }];
  if (params.cabecalho) componentes.unshift({ type: "HEADER", format: "TEXT", text: params.cabecalho });
  if (params.rodape) componentes.push({ type: "FOOTER", text: params.rodape });
  const { data } = await sb
    .from("message_templates")
    .insert({
      user_id: userId, instance_id: params.instanceId, nome: params.nome, categoria: params.categoria, corpo: params.corpo,
      nome_meta: params.nomeMeta || null, idioma: params.idioma || "pt_BR", componentes,
      variaveis: params.variaveis || [], canal: "oficial", status_aprovacao: "rascunho",
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function listarTemplatesDb(sb: SupabaseClient, userId: string): Promise<MessageTemplateRow[]> {
  const { data } = await sb.from("message_templates").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as MessageTemplateRow[]) || [];
}

export async function obterTemplateDb(sb: SupabaseClient, templateId: string): Promise<MessageTemplateRow | null> {
  const { data } = await sb.from("message_templates").select("*").eq("id", templateId).single();
  return (data as MessageTemplateRow) || null;
}

export async function atualizarTemplateDb(sb: SupabaseClient, templateId: string, campos: Partial<MessageTemplateRow>) {
  const { error } = await sb.from("message_templates").update(campos).eq("id", templateId);
  return !error;
}

export async function deletarTemplateDb(sb: SupabaseClient, templateId: string) {
  const { error } = await sb.from("message_templates").delete().eq("id", templateId);
  return !error;
}

// ── Etapas da cadência ────────────────────────────────────────────────────────

export async function criarEtapa(
  sb: SupabaseClient,
  campaignId: string,
  params: { ordem: number; atrasoHoras: number; corpoMensagem: string; midiaUrl?: string; templateId?: string; parametrosTemplate?: string[] },
) {
  const payload: Record<string, unknown> = {
    campaign_id: campaignId, ordem: params.ordem, atraso_horas: params.atrasoHoras,
    corpo_mensagem: params.corpoMensagem, midia_url: params.midiaUrl || null,
  };
  if (params.templateId) {
    payload.template_id = params.templateId;
    payload.parametros_template = params.parametrosTemplate || [];
  }
  const { data } = await sb.from("dispatch_cadence_steps").insert(payload).select("id").single();
  return data?.id as string | undefined;
}

export async function listarEtapas(sb: SupabaseClient, campaignId: string): Promise<CadenceStepRow[]> {
  const { data } = await sb.from("dispatch_cadence_steps").select("*").eq("campaign_id", campaignId).order("ordem");
  return (data as CadenceStepRow[]) || [];
}

export async function deletarEtapa(sb: SupabaseClient, stepId: string) {
  const { error } = await sb.from("dispatch_cadence_steps").delete().eq("id", stepId);
  return !error;
}

export function proximaEtapa(etapas: CadenceStepRow[], currentStepOrdem: number): CadenceStepRow | null {
  return etapas.find((e) => e.ordem > currentStepOrdem) || null;
}

// ── Opt-out ────────────────────────────────────────────────────────────────

export async function estaOptOut(sb: SupabaseClient, telefone: string, userId: string): Promise<boolean> {
  const { data } = await sb.from("dispatch_opt_outs").select("telefone").eq("telefone", telefone).eq("user_id", userId).limit(1);
  return Boolean(data?.length);
}

export async function registrarOptOut(sb: SupabaseClient, telefone: string, userId: string, motivo = "") {
  const { error } = await sb.from("dispatch_opt_outs").upsert(
    { telefone, user_id: userId, motivo: motivo || null },
    { onConflict: "telefone,user_id" },
  );
  return !error;
}

// ── Alvos (targets) ───────────────────────────────────────────────────────────

export interface LeadParaEnroll {
  nome?: string | null;
  telefone?: string | null;
  [key: string]: unknown;
}

export interface EnrollResultado {
  inscritos: number;
  invalidos: number;
  duplicados: number;
  opt_out: number;
}

/**
 * Inscreve leads numa campanha. Normaliza telefone pra E.164, ignora quem
 * estiver em opt-out, ignora duplicata (mesmo telefone já inscrito nesta
 * campanha — a constraint UNIQUE(campaign_id, telefone) é a rede de
 * segurança real).
 */
export async function enrollTargets(sb: SupabaseClient, campaignId: string, leads: LeadParaEnroll[]): Promise<EnrollResultado> {
  const vazio: EnrollResultado = { inscritos: 0, invalidos: 0, duplicados: 0, opt_out: 0 };

  const campanha = await obterCampanha(sb, campaignId);
  if (!campanha) return vazio;
  const donoUserId = campanha.user_id;

  const etapas = await listarEtapas(sb, campaignId);
  if (!etapas.length) return vazio;
  const primeira = etapas[0];
  const proximaEm = new Date(Date.now() + Number(primeira.atraso_horas || 0) * 3_600_000).toISOString();

  const porTelefone = new Map<string, LeadParaEnroll>();
  let invalidos = 0;
  let duplicadosLote = 0;
  for (const lead of leads) {
    const tel = normalizarE164(String(lead.telefone || ""));
    if (!tel) {
      invalidos += 1;
      continue;
    }
    if (porTelefone.has(tel)) {
      duplicadosLote += 1;
      continue;
    }
    porTelefone.set(tel, lead);
  }

  if (!porTelefone.size) return { inscritos: 0, invalidos, duplicados: duplicadosLote, opt_out: 0 };

  const optOuts = new Set<string>();
  const todosTels = Array.from(porTelefone.keys());
  for (let i = 0; i < todosTels.length; i += 500) {
    const { data } = await sb
      .from("dispatch_opt_outs")
      .select("telefone")
      .eq("user_id", donoUserId)
      .in("telefone", todosTels.slice(i, i + 500));
    for (const r of data || []) optOuts.add(r.telefone as string);
  }

  let optOutCount = 0;
  const linhas: Array<Record<string, unknown>> = [];
  for (const [tel, lead] of porTelefone) {
    if (optOuts.has(tel)) {
      optOutCount += 1;
      continue;
    }
    linhas.push({
      campaign_id: campaignId,
      nome: String(lead.nome || ""),
      telefone: tel,
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
      .from("dispatch_targets")
      .upsert(linhas.slice(i, i + 500), { onConflict: "campaign_id,telefone", ignoreDuplicates: true })
      .select("id");
    inscritos += data?.length || 0;
  }

  const duplicadosDb = Math.max(0, linhas.length - inscritos);
  return { inscritos, invalidos, duplicados: duplicadosLote + duplicadosDb, opt_out: optOutCount };
}

export async function listarTargetsCampanha(sb: SupabaseClient, campaignId: string): Promise<DispatchTargetRow[]> {
  const { data } = await sb.from("dispatch_targets").select("*").eq("campaign_id", campaignId).order("criado_em", { ascending: false });
  return (data as DispatchTargetRow[]) || [];
}

export async function statsCampanha(sb: SupabaseClient, campaignId: string) {
  const targets = await listarTargetsCampanha(sb, campaignId);
  const stats: Record<string, number> = { total: targets.length, pendente: 0, enviando: 0, enviado: 0, concluido: 0, falhou: 0, removido: 0 };
  for (const t of targets) stats[t.status] = (stats[t.status] || 0) + 1;
  return stats;
}

// ── Fila de disparo (usada pelo worker) ────────────────────────────────────

export async function atualizarTarget(sb: SupabaseClient, targetId: string, campos: Partial<DispatchTargetRow>) {
  const { error } = await sb.from("dispatch_targets").update(campos).eq("id", targetId);
  return !error;
}

/** Reivindica atomicamente 1 alvo pronto pra envio pra essa instância (RPC claim_dispatch_target). */
export async function claimTargetParaInstancia(sb: SupabaseClient, instanceId: string): Promise<DispatchTargetRow | null> {
  const { data } = await sb.rpc("claim_dispatch_target", { p_instance_id: instanceId });
  const rows = (data as DispatchTargetRow[]) || [];
  return rows[0] || null;
}

export async function marcarEnviado(
  sb: SupabaseClient,
  target: DispatchTargetRow,
  campaignId: string,
  step: CadenceStepRow,
  etapas: CadenceStepRow[],
  evolutionMessageId: string,
  corpoEnviado: string,
) {
  const prox = proximaEtapa(etapas, step.ordem);
  const agora = new Date();
  if (prox) {
    const atraso = Number(prox.atraso_horas || 0) * 3_600_000;
    await sb.from("dispatch_targets").update({
      status: "pendente", current_step_id: step.id,
      proxima_etapa_em: new Date(agora.getTime() + atraso).toISOString(),
      atualizado_em: agora.toISOString(),
    }).eq("id", target.id);
  } else {
    await sb.from("dispatch_targets").update({
      status: "concluido", current_step_id: step.id, atualizado_em: agora.toISOString(),
    }).eq("id", target.id);
  }

  await sb.from("dispatch_messages_log").insert({
    target_id: target.id, campaign_id: campaignId, step_id: step.id,
    status: "sucesso", evolution_message_id: evolutionMessageId, corpo_enviado: corpoEnviado,
  });
}

export async function marcarFalha(
  sb: SupabaseClient, target: DispatchTargetRow, campaignId: string, step: CadenceStepRow | null, erroMsg: string, corpoEnviado = "",
) {
  await sb.from("dispatch_targets").update({ status: "falhou", atualizado_em: new Date().toISOString() }).eq("id", target.id);
  await sb.from("dispatch_messages_log").insert({
    target_id: target.id, campaign_id: campaignId, step_id: step?.id || null,
    status: "erro", erro_msg: String(erroMsg).slice(0, 500), corpo_enviado: corpoEnviado,
  });
}

/** Recupera alvos travados em 'enviando' há mais de `minutos` (crash mid-send) — entrega é 'pelo menos uma vez'. */
export async function requeueTravados(sb: SupabaseClient, minutos = 5): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60_000).toISOString();
  const { data } = await sb.from("dispatch_targets").update({ status: "pendente" }).eq("status", "enviando").lt("reservado_em", limite).select("id");
  return data?.length || 0;
}

/** Após um envio, sorteia e grava quando a instância pode enviar de novo (rate limit anti-banimento). */
export async function liberarProximoEnvio(sb: SupabaseClient, instanceId: string, intervaloMinSeg: number, intervaloMaxSeg: number) {
  const agora = new Date();
  const min = Math.max(1, Math.floor(intervaloMinSeg));
  const max = Math.max(min, Math.floor(intervaloMaxSeg));
  const delaySeg = min + Math.floor(Math.random() * (max - min + 1));
  await sb.from("whatsapp_instances").update({
    ultimo_envio_em: agora.toISOString(),
    proximo_envio_liberado_em: new Date(agora.getTime() + delaySeg * 1000).toISOString(),
  }).eq("id", instanceId);
}

export type { InstanceCanal };
