/**
 * Worker de background — processo Node separado do app Next.js, deployado
 * como um segundo serviço Railway apontando pro mesmo repositório (comando
 * de start diferente: `npm run worker`). Roda os dois schedulers do
 * produto atual (modules/scheduler.py e modules/dispatch_scheduler.py):
 * automações agendadas e a fila de disparo WhatsApp — e também o
 * processamento em background do Enriquecimento de Leads via IA (feature
 * nova do produto atual, portada com uma melhoria: lá roda síncrono na
 * mesma requisição HTTP; aqui roda em background e fica persistido, ver
 * worker/enrichment-tick.ts).
 *
 * Não depende de nada do Next.js — só do cliente Supabase service-role e
 * dos módulos de integração em src/lib, que são puro TypeScript.
 */
// Em produção (Railway) as variáveis já vêm do ambiente — isto é só
// conveniência para rodar localmente, mesma convenção do Next.js
// (.env.local tem prioridade sobre .env).
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createAdminClient } from "../src/lib/supabase/admin";
import { tickAutomations } from "./automation-tick";
import { tickDispatch, tickSheetWatchAndAutoTrigger } from "./dispatch-tick";
import { tickEnrichment } from "./enrichment-tick";

const AUTOMATION_TICK_MS = 60_000;
const DISPATCH_TICK_MS = 15_000;
const SHEET_WATCH_TICK_MS = 120_000;
// Mais frequente que as outras: ao contrário de automações (rodam sem
// ninguém olhando), quem dispara um enriquecimento costuma estar com a
// tela aberta esperando o progresso.
const ENRICHMENT_TICK_MS = 10_000;

function log(origem: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${origem}] ${msg}`);
}

async function main() {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const faltando = required.filter((k) => !process.env[k]);
  if (faltando.length) {
    console.error(`Variáveis de ambiente faltando: ${faltando.join(", ")}`);
    process.exit(1);
  }

  const sb = createAdminClient();
  log("worker", "Iniciado — automações a cada 60s, disparo a cada 15s, sheet-watch/auto-trigger a cada 120s, enriquecimento IA a cada 10s.");

  // Aguarda um pouco no início, mesma cautela do produto atual (deixa o
  // resto da infra terminar de subir antes do primeiro tick).
  await new Promise((r) => setTimeout(r, 5_000));

  setInterval(() => {
    tickAutomations(sb, (m) => log("automations", m)).catch((e) => log("automations", `tick error: ${e.message}`));
  }, AUTOMATION_TICK_MS);

  setInterval(() => {
    tickDispatch(sb, (m) => log("dispatch", m)).catch((e) => log("dispatch", `tick error: ${e.message}`));
  }, DISPATCH_TICK_MS);

  setInterval(() => {
    tickSheetWatchAndAutoTrigger(sb, (m) => log("dispatch/watch", m)).catch((e) => log("dispatch/watch", `tick error: ${e.message}`));
  }, SHEET_WATCH_TICK_MS);

  setInterval(() => {
    tickEnrichment(sb, (m) => log("enrichment", m)).catch((e) => log("enrichment", `tick error: ${e.message}`));
  }, ENRICHMENT_TICK_MS);
}

main().catch((e) => {
  console.error("Worker falhou ao iniciar:", e);
  process.exit(1);
});
