import type { SupabaseClient } from "@supabase/supabase-js";
import { avaliarGatilhos, avancarRuns } from "../src/lib/flow/flow-engine";
import { rotearSaidasDeDisparo } from "../src/lib/flow/saidas-disparo";

let gatilhosRodando = false;

/**
 * Construtor de fluxos: avalia gatilhos de fluxos ativos, abre os ramos das
 * saídas por resultado dos disparos e avança runs em andamento, 1 nó por tick.
 */
export async function tickFlows(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  // Gatilhos e saídas de disparo não podem se sobrepor (abririam a mesma
  // execução duas vezes); um tick que encontra a etapa anterior ainda
  // rodando só avança as runs livres.
  if (!gatilhosRodando) {
    gatilhosRodando = true;
    try {
      await avaliarGatilhos(sb, log);
      await rotearSaidasDeDisparo(sb, log);
    } finally {
      gatilhosRodando = false;
    }
  }
  await avancarRuns(sb, log);
}
