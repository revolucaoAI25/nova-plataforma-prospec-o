import type { SupabaseClient } from "@supabase/supabase-js";
import { obterAutomacoesVencidas, registrarExecucao } from "../src/lib/automation-db";
import { reservarAutomacao, executarAutomacao } from "../src/lib/automation-runner";

/** Verifica e executa automações vencidas — portado de modules/scheduler.py (AutomationScheduler). */
export async function tickAutomations(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  const vencidas = await obterAutomacoesVencidas(sb);
  if (!vencidas.length) return;

  log(`${vencidas.length} automação(ões) vencida(s)`);

  for (const auto of vencidas) {
    // "Reserva" a automação antes de executar — evita duplo disparo caso o
    // tick seguinte rode antes desta execução terminar.
    await reservarAutomacao(sb, auto);

    // Dispara sem aguardar (equivalente à thread por automação do produto
    // atual) — uma automação lenta não atrasa as outras vencidas neste tick.
    executarAutomacao(sb, auto).catch(async (e) => {
      log(`Erro na automação ${auto.id}: ${(e as Error).message}`);
      try {
        await registrarExecucao(sb, auto.id, auto.user_id, "error", 0, String((e as Error).message).slice(0, 500));
      } catch {
        // nada mais a fazer se nem o log conseguir ser gravado
      }
    });
  }
}
