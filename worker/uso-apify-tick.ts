/**
 * Avisa o admin quando o consumo do mês no provedor das buscas (Google Maps,
 * Instagram, LinkedIn) chega perto do limite da conta: 60%, 80% e 95%, um
 * aviso por faixa em cada ciclo de cobrança (só o da faixa mais alta já
 * alcançada). Os clientes nunca veem isso.
 */
import { chaveApify } from "../src/lib/platform-keys";
import { obterUsoApify } from "../src/lib/integrations/apify-uso";
import { registrarAlertaAdmin } from "../src/lib/alertas-admin";

const FAIXAS = [
  { pct: 95, nivel: "critico" as const },
  { pct: 80, nivel: "aviso" as const },
  { pct: 60, nivel: "aviso" as const },
];

const usd = (v: number) => `US$ ${v.toFixed(2).replace(".", ",")}`;
const data = (iso: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "o fim do ciclo");

export async function tickUsoApify(log: (msg: string) => void): Promise<void> {
  const token = await chaveApify();
  if (!token) return;
  let uso;
  try {
    uso = await obterUsoApify(token);
  } catch (err) {
    log(`não consultou o uso: ${(err as Error).message}`);
    return;
  }
  const pct = (uso.usadoUsd / uso.limiteUsd) * 100;
  const faixa = FAIXAS.find((f) => pct >= f.pct);
  if (!faixa) return;

  const ciclo = uso.cicloInicio.slice(0, 10) || new Date().toISOString().slice(0, 7);
  const resta = Math.max(0, uso.limiteUsd - uso.usadoUsd);
  await registrarAlertaAdmin({
    chave: `apify:${faixa.pct}:${ciclo}`,
    nivel: faixa.nivel,
    titulo: `Buscas: ${Math.floor(pct)}% do limite do mês no Apify`,
    mensagem:
      `O consumo do Apify (Google Maps, Instagram e LinkedIn) está em ${usd(uso.usadoUsd)} de ${usd(uso.limiteUsd)} neste ciclo, que vai até ${data(uso.cicloFim)}. ` +
      `Restam ${usd(resta)}. Quando o limite acabar, essas buscas param para os clientes até o ciclo virar ou até você assinar um plano no Apify ` +
      `(Billing → Subscription). Os clientes não veem este aviso.`,
    link: "https://console.apify.com/billing",
  });
  log(`uso em ${pct.toFixed(0)}% (${usd(uso.usadoUsd)} de ${usd(uso.limiteUsd)})`);
}
