import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationRow, AutomationRunRow, AutomationTipo, Json } from "@/lib/database.types";

// CRUD de automações — portado de modules/automation_db.py. Parametrizado
// por cliente Supabase (ver comentário em dispatch-db.ts sobre a mudança
// de arquitetura em relação ao produto atual).

export async function listarAutomacoesUsuario(sb: SupabaseClient, userId: string): Promise<AutomationRow[]> {
  const { data } = await sb.from("automations").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data as AutomationRow[]) || [];
}

export async function criarAutomacao(
  sb: SupabaseClient,
  userId: string,
  params: {
    nome: string; tipo: AutomationTipo; filtros: Json; sheetId?: string; sheetAba?: string;
    diasSemana: number[]; horario: string; proximaExecucao?: string | null; dispatchCampaignId?: string | null;
  },
): Promise<string | undefined> {
  const payload: Record<string, unknown> = {
    user_id: userId, nome: params.nome, tipo: params.tipo, filtros: params.filtros,
    sheet_id: params.sheetId || null, sheet_aba: params.sheetAba || "Leads",
    dias_semana: params.diasSemana, horario: params.horario, ativa: true,
  };
  if (params.dispatchCampaignId) payload.dispatch_campaign_id = params.dispatchCampaignId;
  if (params.proximaExecucao) payload.proxima_execucao = params.proximaExecucao;
  const { data } = await sb.from("automations").insert(payload).select("id").single();
  return data?.id as string | undefined;
}

export async function atualizarAutomacao(sb: SupabaseClient, autoId: string, campos: Partial<AutomationRow>) {
  const { error } = await sb.from("automations").update(campos).eq("id", autoId);
  return !error;
}

export async function deletarAutomacao(sb: SupabaseClient, autoId: string) {
  const { error } = await sb.from("automations").delete().eq("id", autoId);
  return !error;
}

/** Automações ativas com proxima_execucao <= agora — usado pelo worker. */
export async function obterAutomacoesVencidas(sb: SupabaseClient): Promise<AutomationRow[]> {
  const agoraIso = new Date().toISOString();
  const { data } = await sb
    .from("automations")
    .select("*")
    .eq("ativa", true)
    .lte("proxima_execucao", agoraIso)
    .not("proxima_execucao", "is", null);
  return (data as AutomationRow[]) || [];
}

export async function registrarExecucao(
  sb: SupabaseClient, autoId: string, userId: string, status: AutomationRunRow["status"], leads = 0, erro = "",
) {
  const { error } = await sb.from("automation_runs").insert({
    automation_id: autoId, user_id: userId, concluida_em: new Date().toISOString(),
    leads_encontrados: leads, status, erro: erro || null,
  });
  return !error;
}

export async function obterUltimasExecucoes(sb: SupabaseClient, autoId: string, limit = 5): Promise<AutomationRunRow[]> {
  const { data } = await sb.from("automation_runs").select("*").eq("automation_id", autoId).order("iniciada_em", { ascending: false }).limit(limit);
  return (data as AutomationRunRow[]) || [];
}
