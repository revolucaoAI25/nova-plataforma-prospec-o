/**
 * Worker de background — processo Node separado do app Next.js, deployado
 * como um segundo serviço Railway apontando pro mesmo repositório (comando
 * de start diferente: `npm run worker`). Roda os fluxos de automação, as
 * filas de disparo (WhatsApp, e-mail, LinkedIn) e os enriquecimentos em
 * background (IA e celular do sócio).
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
import { tickOnboarding } from "./onboarding-tick";
import { tickRetomada } from "./retomada-tick";
import { tickAcesso } from "./acesso-tick";

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
// Geração dos planos do onboarding — o cliente fica na tela esperando.
const ONBOARDING_TICK_MS = 10_000;
// E-mails de retomada (teste grátis e pagamento não concluído): as etapas são
// em horas, então 15 min de espaço sobra.
const RETOMADA_TICK_MS = 900_000;
// Pausa campanhas e automações de quem perdeu o acesso (fim do período pago).
const ACESSO_TICK_MS = 600_000;

function log(origem: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${origem}] ${msg}`);
}

/**
 * Roda `tick` a cada `ms` sem acumular rodadas: se já há `maxParalelo`
 * rodadas em andamento (lote grande, API lenta), a próxima é pulada em vez
 * de abrir mais uma — que só multiplicaria consultas ao banco e disputaria o
 * mesmo trabalho. Disparos ficam em 1; tarefas longas que atendem vários
 * clientes (fluxos, enriquecimentos, onboarding) aceitam algumas em
 * paralelo, para o lote grande de um cliente não segurar os outros.
 */
function agendar(nome: string, ms: number, tick: () => Promise<void>, maxParalelo = 1) {
  let rodando = 0;
  setInterval(async () => {
    if (rodando >= maxParalelo) return;
    rodando += 1;
    try {
      await tick();
    } catch (e) {
      log(nome, `tick error: ${(e as Error).message}`);
    } finally {
      rodando -= 1;
    }
  }, ms);
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
      "celular do sócio a cada 10s, planos do onboarding a cada 10s.",
  );

  // Aguarda um pouco no início, mesma cautela do produto atual (deixa o
  // resto da infra terminar de subir antes do primeiro tick).
  await new Promise((r) => setTimeout(r, 5_000));

  agendar("dispatch", DISPATCH_TICK_MS, () => tickDispatch(sb, (msg) => log("dispatch", msg)));

  agendar("dispatch/watch", SHEET_WATCH_TICK_MS, () => tickSheetWatchAndAutoTrigger(sb, (msg) => log("dispatch/watch", msg)));

  agendar("enrichment", ENRICHMENT_TICK_MS, () => tickEnrichment(sb, (msg) => log("enrichment", msg)), 3);

  agendar("flows", FLOW_TICK_MS, () => tickFlows(sb, (msg) => log("flows", msg)), 3);

  agendar("email-dispatch", EMAIL_DISPATCH_TICK_MS, () => tickEmailDispatch(sb, (msg) => log("email-dispatch", msg)));

  agendar("email-dispatch/watch", EMAIL_SHEET_WATCH_TICK_MS, () => tickEmailSheetWatchAndAutoTrigger(sb, (msg) => log("email-dispatch/watch", msg)));

  agendar("linkedin-dispatch", LINKEDIN_DISPATCH_TICK_MS, () => tickLinkedInDispatch(sb, (msg) => log("linkedin-dispatch", msg)));

  agendar("linkedin-dispatch/watch", LINKEDIN_SHEET_WATCH_TICK_MS, () => tickLinkedInSheetWatchAndAutoTrigger(sb, (msg) => log("linkedin-dispatch/watch", msg)));

  agendar("linkedin-dispatch/poll", LINKEDIN_RELATIONS_POLL_MS, () => tickLinkedInRelationsPoll(sb, (msg) => log("linkedin-dispatch/poll", msg)));

  agendar("bigdatacorp-enrichment", BIGDATACORP_ENRICHMENT_TICK_MS, () => tickBigDataCorpEnrichment(sb, (msg) => log("bigdatacorp-enrichment", msg)), 3);

  agendar("onboarding", ONBOARDING_TICK_MS, () => tickOnboarding(sb, (msg) => log("onboarding", msg)), 3);

  agendar("retomada", RETOMADA_TICK_MS, () => tickRetomada(sb, (msg) => log("retomada", msg)));

  agendar("acesso", ACESSO_TICK_MS, () => tickAcesso(sb, (msg) => log("acesso", msg)));
}

main().catch((e) => {
  console.error("Worker falhou ao iniciar:", e);
  process.exit(1);
});
