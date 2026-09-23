import { getProfile } from "@/lib/credits";
import { exportar } from "@/lib/integrations/google-sheets";
import type { GoogleSheetsCreds, LeadRow } from "@/lib/database.types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

export async function executarDestinoSheets(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { sb, userId, node, contexto } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const sheetId = String(config.sheetId || "");
  const aba = String(config.aba || "Leads");
  const modo = config.modo === "substituir" ? "substituir" : "acrescentar";
  if (!sheetId) return { status: "erro", erro: "Informe a planilha de destino." };

  const lote = contexto.lote || [];
  if (!lote.length) {
    return { status: "concluido", leadsEntrada: 0, leadsSaida: 0, detalhe: { sheetId, aba, exportados: 0 } };
  }

  const profile = await getProfile(sb, userId);
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds | null)?.oauth;
  if (!creds) return { status: "erro", erro: "Google Sheets não está conectado (Configurações)." };

  const resultado = await exportar(lote as unknown as LeadRow[], creds, sheetId, aba, modo);
  if (!resultado.ok) return { status: "erro", erro: resultado.msg };

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: lote.length,
    detalhe: { sheetId, aba, exportados: lote.length },
  };
}
