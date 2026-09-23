import { getProfile } from "@/lib/credits";
import { exportarGenerico } from "@/lib/integrations/google-sheets";
import { COLUNAS_PADRAO } from "@/lib/export";
import { ENRIQUECIMENTO_LABELS } from "../enrichment-merge";
import type { GoogleSheetsCreds } from "@/lib/database.types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

function humanizarChave(chave: string): string {
  return chave.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Colunas fixas conhecidas (mesmo conjunto completo do export CSV/XLSX,
 * `COLUNAS_PADRAO`) + qualquer chave extra presente no lote — campos de
 * enriquecimento (`enriquecimento_*`, rótulo amigável) e quaisquer outras
 * (ex.: colunas originais de uma planilha-gatilho), com rótulo humanizado.
 * Não reaproveita `exportar()`/`COLUNAS_EXPORT` (uso avulso/automações
 * antigas) pra não arriscar mudar o layout de planilhas já configuradas
 * por quem já usa aquele caminho.
 */
function colunasParaLote(lote: Array<Record<string, unknown>>): Array<{ chave: string; label: string }> {
  const chavesConhecidas = new Set<string>(COLUNAS_PADRAO.map(([c]) => c as string));
  const colunas = COLUNAS_PADRAO.map(([chave, label]) => ({ chave: chave as string, label }));

  const chavesExtras = new Set<string>();
  for (const lead of lote) {
    for (const chave of Object.keys(lead)) {
      if (!chavesConhecidas.has(chave)) chavesExtras.add(chave);
    }
  }

  const enriquecimento = [...chavesExtras].filter((c) => c.startsWith("enriquecimento_")).sort();
  const outras = [...chavesExtras].filter((c) => !c.startsWith("enriquecimento_")).sort();
  for (const chave of enriquecimento) colunas.push({ chave, label: ENRIQUECIMENTO_LABELS[chave] || humanizarChave(chave) });
  for (const chave of outras) colunas.push({ chave, label: humanizarChave(chave) });

  return colunas;
}

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

  const colunas = colunasParaLote(lote);
  const resultado = await exportarGenerico(lote, colunas, creds, sheetId, aba, modo);
  if (!resultado.ok) return { status: "erro", erro: resultado.msg };

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: lote.length,
    detalhe: { sheetId, aba, exportados: lote.length, colunas: colunas.length },
  };
}
