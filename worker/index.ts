/**
 * Worker de background — processo Node separado do app Next.js, deployado
 * como um segundo serviço Railway apontando pro mesmo repositório (comando
 * de start diferente: `npm run worker`). Roda os fluxos de automação, as
 * filas de disparo (WhatsApp, e-mail, LinkedIn) e os enriquecimentos em
 * background (IA e BigDataCorp).
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
import { tickDispatch, tickSheetWatchAndAutoTrigger } from "./dispatch-tick";
import { tickEnrichment } from "./enrichment-tick";
import { tickFlows } from "./flow-tick";
import { tickEmailDispatch, tickEmailSheetWatchAndAutoTrigger } from "./email-dispatch-tick";
import { tickLinkedInDispatch, tickLinkedInSheetWatchAndAutoTrigger, tickLinkedInRelationsPoll } from "./linkedin-dispatch-tick";
import { tickBigDataCorpEnrichment } from "./bigdatacorp-enrichment-tick";

const DISPATCH_TICK_MS = 15_000;
const SHEET_WATCH_TICK_MS = 120_000;
// Disparo por e-mail envia em LOTE (até 20 alvos por campanha por tick,
// via Resend), diferente do WhatsApp que envia 1 por instância por tick —
// por isso pode ser mais espaçado sem perder throughput.
const EMAIL_DISPATCH_TICK_MS = 20_000;
const EMAIL_SHEET_WATCH_TICK_MS = 120_000;
// Disparo por LinkedIn — 1 ação por conta por tick, como o WhatsApp
// (nunca em lote: o volume seguro por dia é baixo e o espaçamento entre
// ações precisa ser de minutos, não segundos, pra não parecer bot). A
// maioria dos ticks não faz nada por causa do pacing/limite diário.
const LINKEDIN_DISPATCH_TICK_MS = 30_000;
const LINKEDIN_SHEET_WATCH_TICK_MS = 120_000;
// Poll de reforço pra detectar aceite de convite (atrás do webhook
// new_relation) — bem espaçado de propósito, seguindo a recomendação da
// própria doc da Unipile de checar isso só algumas vezes por dia.
const LINKEDIN_RELATIONS_POLL_MS = 7_200_000;
// Mais frequente que as outras: quem dispara um enriquecimento costuma
// estar com a tela aberta esperando o progresso.
const ENRICHMENT_TICK_MS = 10_000;
// Mesmo raciocínio do enriquecimento via IA — quem dispara costuma estar
// acompanhando o progresso na tela.
const BIGDATACORP_ENRICHMENT_TICK_MS = 10_000;
// Fluxos (construtor visual) — avança 1 nó por run por tick; frequência
// parecida com a de disparo, já que uma run pode ter vários nós em
// sequência e o usuário pode estar acompanhando o histórico de execução.
const FLOW_TICK_MS = 20_000;

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
  log(
    "worker",
    "Iniciado — disparo a cada 15s, sheet-watch/auto-trigger a cada 120s, " +
      "enriquecimento IA a cada 10s, fluxos a cada 20s, disparo e-mail a cada 20s, " +
      "sheet-watch/auto-trigger e-mail a cada 120s, disparo LinkedIn a cada 30s, " +
      "sheet-watch/auto-trigger LinkedIn a cada 120s, poll de aceite de convite a cada 2h, " +
      "enriquecimento BigDataCorp a cada 10s.",
  );

  // Aguarda um pouco no início, mesma cautela do produto atual (deixa o
  // resto da infra terminar de subir antes do primeiro tick).
  await new Promise((r) => setTimeout(r, 5_000));

  setInterval(() => {
    tickDispatch(sb, (m) => log("dispatch", m)).catch((e) => log("dispatch", `tick error: ${e.message}`));
  }, DISPATCH_TICK_MS);

  setInterval(() => {
    tickSheetWatchAndAutoTrigger(sb, (m) => log("dispatch/watch", m)).catch((e) => log("dispatch/watch", `tick error: ${e.message}`));
  }, SHEET_WATCH_TICK_MS);

  setInterval(() => {
    tickEnrichment(sb, (m) => log("enrichment", m)).catch((e) => log("enrichment", `tick error: ${e.message}`));
  }, ENRICHMENT_TICK_MS);

  setInterval(() => {
    tickFlows(sb, (m) => log("flows", m)).catch((e) => log("flows", `tick error: ${e.message}`));
  }, FLOW_TICK_MS);

  setInterval(() => {
    tickEmailDispatch(sb, (m) => log("email-dispatch", m)).catch((e) => log("email-dispatch", `tick error: ${e.message}`));
  }, EMAIL_DISPATCH_TICK_MS);

  setInterval(() => {
    tickEmailSheetWatchAndAutoTrigger(sb, (m) => log("email-dispatch/watch", m)).catch((e) => log("email-dispatch/watch", `tick error: ${e.message}`));
  }, EMAIL_SHEET_WATCH_TICK_MS);

  setInterval(() => {
    tickLinkedInDispatch(sb, (m) => log("linkedin-dispatch", m)).catch((e) => log("linkedin-dispatch", `tick error: ${e.message}`));
  }, LINKEDIN_DISPATCH_TICK_MS);

  setInterval(() => {
    tickLinkedInSheetWatchAndAutoTrigger(sb, (m) => log("linkedin-dispatch/watch", m)).catch((e) => log("linkedin-dispatch/watch", `tick error: ${e.message}`));
  }, LINKEDIN_SHEET_WATCH_TICK_MS);

  setInterval(() => {
    tickLinkedInRelationsPoll(sb, (m) => log("linkedin-dispatch/poll", m)).catch((e) => log("linkedin-dispatch/poll", `tick error: ${e.message}`));
  }, LINKEDIN_RELATIONS_POLL_MS);

  setInterval(() => {
    tickBigDataCorpEnrichment(sb, (m) => log("bigdatacorp-enrichment", m)).catch((e) => log("bigdatacorp-enrichment", `tick error: ${e.message}`));
  }, BIGDATACORP_ENRICHMENT_TICK_MS);
}

main().catch((e) => {
  console.error("Worker falhou ao iniciar:", e);
  process.exit(1);
});
