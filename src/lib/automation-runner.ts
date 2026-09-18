import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile, debitarCreditos } from "@/lib/credits";
import { resolverChaveMaps, resolverChaveMapsOverflow, registrarUsoChaveMaps } from "@/lib/maps-key";
import { resolverChaveApify, registrarUsoChaveApify } from "@/lib/apify-key";
import { buscarCnpj, type BuscaTextual } from "@/lib/integrations/casa-dos-dados";
import { buscarMaps, QuotaExceededError } from "@/lib/integrations/google-maps";
import { buscarApifyMaps } from "@/lib/integrations/apify-maps";
import { exportar as sheetsExportar } from "@/lib/integrations/google-sheets";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes, buscarLeadsDaPesquisa } from "@/lib/db";
import { enrollTargets } from "@/lib/dispatch-db";
import { atualizarAutomacao, registrarExecucao } from "@/lib/automation-db";
import { calcularProximaExecucao } from "@/lib/automation-logic";
import type { AutomationRow, GoogleSheetsCreds, Json } from "@/lib/database.types";
import type { Lead } from "@/lib/types";

/** Move proxima_execucao pra 24h no futuro antes de executar — evita disparo duplo (worker + botão manual). */
export async function reservarAutomacao(sb: SupabaseClient, auto: AutomationRow) {
  const sentinel = new Date(Date.now() + 24 * 3_600_000).toISOString();
  await atualizarAutomacao(sb, auto.id, { proxima_execucao: sentinel });
}

async function reagendar(sb: SupabaseClient, auto: AutomationRow) {
  const proxima = calcularProximaExecucao(auto.dias_semana, auto.horario);
  const campos: Record<string, unknown> = { ultima_execucao: new Date().toISOString() };
  if (proxima) campos.proxima_execucao = proxima.toISOString();
  await atualizarAutomacao(sb, auto.id, campos);
}

/**
 * Executa uma automação: busca leads e opcionalmente exporta pro Google
 * Sheets configurado e/ou inscreve numa campanha de disparo vinculada.
 * Portado de modules/scheduler.py `executar_automacao`. Chamado tanto pelo
 * botão "Executar agora" (cliente autenticado, RLS) quanto pelo worker de
 * background (cliente admin, entre usuários).
 */
export async function executarAutomacao(sb: SupabaseClient, auto: AutomationRow): Promise<void> {
  const filtros = (auto.filtros as Record<string, unknown>) || {};

  const dataFimStr = String(filtros.dataFim || "");
  if (dataFimStr) {
    const dataFim = new Date(`${dataFimStr}T23:59:59-03:00`);
    if (new Date() > dataFim) {
      await atualizarAutomacao(sb, auto.id, { ativa: false });
      return;
    }
  }

  const profile = await getProfile(sb, auto.user_id);
  if (!profile) {
    await registrarExecucao(sb, auto.id, auto.user_id, "error", 0, "Perfil não encontrado");
    await reagendar(sb, auto);
    return;
  }

  if (profile.conta_teste && profile.teste_expira_em && new Date(profile.teste_expira_em) <= new Date()) {
    await registrarExecucao(sb, auto.id, auto.user_id, "error", 0, "Conta de teste expirada");
    await atualizarAutomacao(sb, auto.id, { ativa: false });
    return;
  }

  let limite = Number(filtros.limite ?? 50);
  if (auto.tipo === "cnpj") {
    if (profile.cdd_credits < 1) {
      await registrarExecucao(sb, auto.id, auto.user_id, "sem_creditos");
      await reagendar(sb, auto);
      return;
    }
    limite = Math.min(limite, profile.cdd_credits);
  }

  const excludeTels = new Set<string>();
  const excludeCnpjs = new Set<string>();
  {
    const existentes = await buscarIdentificadoresExistentes(sb, auto.user_id);
    existentes.telefones.forEach((t) => excludeTels.add(t));
    existentes.cnpjs.forEach((c) => excludeCnpjs.add(c));
  }

  let resultados: Lead[] = [];
  let usouApify = false;
  let apifyResolucaoUsada: ReturnType<typeof resolverChaveApify> | null = null;

  try {
    if (auto.tipo === "maps") {
      let resolucaoMaps = await resolverChaveMaps(profile);
      const resolucaoApify = resolverChaveApify(profile);
      apifyResolucaoUsada = resolucaoApify;
      if ((resolucaoMaps.bloqueado || !resolucaoMaps.key) && !resolucaoApify.key) {
        const overflow = await resolverChaveMapsOverflow(profile);
        if (overflow.key) resolucaoMaps = overflow;
      }
      const params = {
        queryBase: String(filtros.queryBase || ""),
        localidade: (filtros.localidade as string | string[]) || "",
        limite,
        nicho: String(filtros.nicho || ""),
        subnicho: String(filtros.subnicho || ""),
        cidade: String(filtros.cidade || ""),
        estado: String(filtros.estado || ""),
        excludePhones: excludeTels,
        showPhone: filtros.showPhone !== false,
        showRating: filtros.showRating !== false,
      };

      if (resolucaoMaps.key && !resolucaoMaps.bloqueado) {
        const stats = { text_search_calls: 0, contact_data_calls: 0 };
        try {
          resultados = await buscarMaps({ ...params, apiKey: resolucaoMaps.key, stats });
          const contactDataCalls = params.showPhone ? resultados.length : stats.contact_data_calls;
          await registrarUsoChaveMaps(sb, auto.user_id, profile, resolucaoMaps, contactDataCalls, stats.text_search_calls);
        } catch (e) {
          await registrarUsoChaveMaps(sb, auto.user_id, profile, resolucaoMaps, stats.contact_data_calls, stats.text_search_calls);
          if (e instanceof QuotaExceededError && resolucaoApify.key) {
            usouApify = true;
            resultados = await buscarApifyMaps({ ...params, apiKey: resolucaoApify.key });
          } else {
            throw e;
          }
        }
      } else if (resolucaoApify.key) {
        usouApify = true;
        resultados = await buscarApifyMaps({ ...params, apiKey: resolucaoApify.key });
      } else {
        await registrarExecucao(sb, auto.id, auto.user_id, "error", 0, "Chave Google Maps/Apify não configurada");
        await reagendar(sb, auto);
        return;
      }
      if (usouApify && resolucaoApify.source === "pool") {
        await registrarUsoChaveApify(sb, auto.user_id, profile, resolucaoApify, resultados.length);
      }
    } else {
      const apiKey = profile.cdd_api_key || profile.cdd_api_key_admin || process.env.CDD_API_KEY || "";
      if (!apiKey) {
        await registrarExecucao(sb, auto.id, auto.user_id, "error", 0, "CDD_API_KEY não configurada");
        await reagendar(sb, auto);
        return;
      }
      const rj = Boolean(filtros.recuperacaoJudicial);
      let buscaTextual: BuscaTextual[] | null = null;
      let situacoesCadastrais: string[] | null = null;
      if (rj) {
        buscaTextual = [{ texto: ["recuperacao judicial"], tipo_busca: "exata", razao_social: true, nome_fantasia: true }];
        situacoesCadastrais = ["ATIVA", "SUSPENSA", "INAPTA"];
      }
      resultados = await buscarCnpj({
        apiKey,
        cnaes: (filtros.cnaes as string[]) || [],
        uf: (filtros.uf as string | string[]) || "",
        municipio: (filtros.municipio as string | string[]) || "",
        porte: (filtros.porte as string[]) || null,
        matrizFilial: (filtros.matrizFilial as "" | "MATRIZ" | "FILIAL") || "",
        simplesOptante: (filtros.simplesOptante as boolean) ?? null,
        excluirSimples: Boolean(filtros.excluirSimples),
        meiOptante: (filtros.meiOptante as boolean) ?? null,
        excluirMei: Boolean(filtros.excluirMei),
        comTelefone: filtros.comTelefone !== false,
        comEmail: Boolean(filtros.comEmail),
        somenteCelular: Boolean(filtros.somenteCelular),
        somenteFixo: Boolean(filtros.somenteFixo),
        excluirEmailContab: true,
        limite,
        excludePhones: excludeTels,
        excludeCnpjs,
        cnaeTipo: (filtros.cnaeTipo as "principal" | "secundario" | "ambos") || "principal",
        buscaTextual,
        situacoesCadastrais,
        dedupRaiz: rj,
      });
    }
  } catch (e) {
    await registrarExecucao(sb, auto.id, auto.user_id, "error", 0, String((e as Error).message).slice(0, 500));
    await reagendar(sb, auto);
    return;
  }

  const total = resultados.length;
  const comoTexto = (v: unknown): string => (Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v || ""));

  const searchId = await salvarPesquisa(sb, auto.user_id, {
    fonte: auto.tipo === "maps" ? "google_maps" : "cnpj",
    nicho: String(filtros.nicho || (Array.isArray(filtros.cnaes) ? filtros.cnaes[0] : "") || ""),
    subnicho: String(filtros.subnicho || ""),
    cidade: comoTexto(filtros.cidade),
    estado: comoTexto(filtros.estado || filtros.uf),
    localidade: comoTexto(filtros.localidade || filtros.municipio),
    totalResults: total,
    filtros: filtros as Json,
  });

  let leadsSalvosOk = true;
  if (searchId && total) {
    leadsSalvosOk = await salvarLeads(sb, auto.user_id, searchId, resultados);
  }

  if (auto.tipo === "cnpj" && total > 0) {
    await debitarCreditos(sb, auto.user_id, "cdd_credits", total);
  } else if (auto.tipo === "maps" && profile.maps_credits_enabled && total > 0 && (!usouApify || apifyResolucaoUsada?.source === "pool")) {
    await debitarCreditos(sb, auto.user_id, "maps_credits", total);
  }

  let sheetsStatus: "success" | "error" | "sem_sheets" = "success";
  let sheetsErro = "";
  if (auto.sheet_id && total && searchId) {
    const creds = profile.google_sheets_creds as GoogleSheetsCreds | null;
    if (creds?.oauth) {
      try {
        const leadRows = await buscarLeadsDaPesquisa(sb, searchId);
        const resultado = await sheetsExportar(leadRows, creds.oauth, auto.sheet_id, auto.sheet_aba || "Leads", "acrescentar");
        if (!resultado.ok) {
          sheetsStatus = "error";
          sheetsErro = resultado.msg;
        }
      } catch (e) {
        sheetsStatus = "error";
        sheetsErro = (e as Error).message;
      }
    } else {
      sheetsStatus = "sem_sheets";
    }
  }

  if (auto.dispatch_campaign_id && total) {
    try {
      await enrollTargets(sb, auto.dispatch_campaign_id, resultados as unknown as Array<{ nome?: string; telefone?: string }>);
    } catch {
      // falha no disparo vinculado não deve derrubar o log da automação em si
    }
  }

  if (!searchId) {
    await registrarExecucao(sb, auto.id, auto.user_id, "error", total, "Falha ao registrar a pesquisa no histórico.");
  } else if (!leadsSalvosOk) {
    await registrarExecucao(sb, auto.id, auto.user_id, "error", total, `Busca encontrou ${total} leads, mas falhou ao salvá-los no histórico.`);
  } else {
    await registrarExecucao(sb, auto.id, auto.user_id, sheetsStatus, total, sheetsErro.slice(0, 500));
  }

  await reagendar(sb, auto);
}
