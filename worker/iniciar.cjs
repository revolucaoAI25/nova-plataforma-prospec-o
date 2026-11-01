/* eslint-disable @typescript-eslint/no-require-imports -- arquivo CommonJS de propósito (carrega o worker pronto ou o tsx) */
/**
 * Ponto de partida do worker no Railway (`npm run worker`).
 *
 * Roda o worker já convertido para JavaScript no build (worker/dist, gerado
 * por `npm run build:worker`): um processo só, sem o tsx convertendo
 * TypeScript em memória enquanto roda (~55 MB a menos). Se o build do
 * worker não existir (rodando local sem build), cai no tsx como antes.
 */
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const pronto = join(__dirname, "dist", "index.cjs");
if (existsSync(pronto)) {
  require(pronto);
} else {
  console.log("[worker] build do worker não encontrado; rodando pelo tsx");
  require("tsx/cjs");
  require("./index.ts");
}
