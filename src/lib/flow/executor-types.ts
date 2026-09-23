import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlowNode, Json } from "@/lib/database.types";

/**
 * Contrato comum de todo executor de nó (pós-gatilho). Os nós-gatilho
 * (gatilho_*) não passam por aqui — são avaliados à parte pelo motor
 * (src/lib/flow/flow-engine.ts), já que precisam varrer TODOS os fluxos
 * ativos a cada tick, não só o nó atual de uma run já em andamento.
 *
 * `contexto.lote`: o lote de leads "em trânsito" entre nós, como array de
 * dicionários genéricos (não um `LeadRow[]` estrito) — assim o mesmo
 * mecanismo serve tanto pra leads que vieram de `searches`/`leads` quanto
 * pra leads "crus" (ex.: linha de planilha com colunas arbitrárias, que
 * precisam sobreviver até o disparo pra personalização de mensagem via
 * `{{coluna}}`, igual `processarSheetWatcher` já faz em dispatch-tick.ts).
 */
export interface FlowContexto {
  lote?: Array<Record<string, unknown>>;
  searchId?: string;
  enrichmentRunId?: string;
  campaignId?: string;
  [chave: string]: unknown;
}

export interface FlowExecutorContext {
  sb: SupabaseClient;
  userId: string;
  node: FlowNode;
  contexto: FlowContexto;
  log: (msg: string) => void;
}

export type FlowExecutorOutcome =
  | { status: "concluido"; leadsEntrada?: number; leadsSaida?: number; detalhe?: Json; contextoPatch?: FlowContexto }
  | { status: "aguardando_subprocesso"; detalhe?: Json; contextoPatch?: FlowContexto }
  | { status: "erro"; erro: string; detalhe?: Json };

export type FlowNodeExecutor = (ctx: FlowExecutorContext) => Promise<FlowExecutorOutcome>;
