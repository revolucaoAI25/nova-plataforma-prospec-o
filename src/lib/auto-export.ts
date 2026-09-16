import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarLeadsDaPesquisa } from "@/lib/db";
import { exportar } from "@/lib/integrations/google-sheets";
import type { GoogleSheetsCreds } from "@/lib/database.types";

/**
 * Exporta automaticamente os leads de uma pesquisa recém-salva para a
 * planilha marcada como principal, se o usuário tiver Google Sheets
 * conectado e a exportação automática ligada. Falha silenciosamente (só
 * retorna o aviso) — nunca deve impedir a busca de completar.
 */
export async function autoExportarSheetsSeConfigurado(
  supabase: SupabaseClient,
  userId: string,
  searchId: string | null,
): Promise<string | null> {
  if (!searchId) return null;

  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", userId).single();
  const creds = profile?.google_sheets_creds as GoogleSheetsCreds | null;
  if (!creds?.auto_export || !creds.oauth) return null;

  const padrao = creds.planilhas?.find((p) => p.padrao);
  if (!padrao) return null;

  try {
    const leads = await buscarLeadsDaPesquisa(supabase, searchId);
    if (!leads.length) return null;
    const resultado = await exportar(leads, creds.oauth, padrao.id, padrao.aba, padrao.modo);
    return resultado.ok ? `Exportado automaticamente para "${padrao.nome}".` : `Exportação automática falhou: ${resultado.msg}`;
  } catch (e) {
    return `Exportação automática falhou: ${(e as Error).message}`;
  }
}
