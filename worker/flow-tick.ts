import type { SupabaseClient } from "@supabase/supabase-js";
import { avaliarGatilhos, avancarRuns } from "../src/lib/flow/flow-engine";
import { rotearSaidasDeDisparo } from "../src/lib/flow/saidas-disparo";

/**
 * Construtor de fluxos: avalia gatilhos de fluxos ativos, abre os ramos das
 * saídas por resultado dos disparos e avança runs em andamento, 1 nó por tick.
 */
export async function tickFlows(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  await avaliarGatilhos(sb, log);
  await rotearSaidasDeDisparo(sb, log);
  await avancarRuns(sb, log);
}
