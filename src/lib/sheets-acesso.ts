import type { SupabaseClient } from "@supabase/supabase-js";
import { extrairSheetId, listarAbas } from "@/lib/integrations/google-sheets";
import type { GoogleSheetsCreds } from "@/lib/database.types";

/**
 * Antes de salvar um monitoramento de planilha: confere se a conta Google
 * está conectada, se a plataforma consegue abrir a planilha (com o escopo
 * drive.file, só as escolhidas no seletor) e se a aba existe. Devolve o ID
 * limpo, ou a mensagem para mostrar.
 */
export async function conferirPlanilhaParaMonitorar(
  supabase: SupabaseClient,
  userId: string,
  sheetIdOuUrl: string,
  aba: string,
): Promise<{ sheetId: string } | { erro: string }> {
  const { data: profile } = await supabase.from("profiles").select("google_sheets_creds").eq("id", userId).single();
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds | null)?.oauth;
  if (!creds) return { erro: "Conecte a sua conta Google em Conexões para monitorar uma planilha." };
  const sheetId = extrairSheetId(sheetIdOuUrl) ?? sheetIdOuUrl.trim();
  try {
    const abas = await listarAbas(creds, sheetId);
    if (!abas.includes(aba)) return { erro: `A aba "${aba}" não existe nessa planilha. Abas: ${abas.join(", ") || "(nenhuma)"}.` };
  } catch (e) {
    return { erro: (e as Error).message };
  }
  return { sheetId };
}
