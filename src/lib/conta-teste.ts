import { configPlataforma } from "@/lib/platform-settings";

const CREDITOS_PADRAO = 1000;

// Conta de teste: acesso a toda a plataforma, menos o disparo por LinkedIn
// e o canal oficial de WhatsApp (os dois dependem de conta/infra real do
// cliente e têm custo fixo pra nós). Não compra nada — créditos vêm da
// quantidade global configurada em /admin → Chaves da plataforma.
const FLAGS_CONTA_TESTE = {
  instagram_visible: true,
  linkedin_visible: true,
  disparo_habilitado: true,
  email_disparo_habilitado: true,
  enriquecimento_ia_habilitado: true,
  bigdatacorp_enrichment_habilitado: true,
  linkedin_disparo_habilitado: false,
} as const;

export async function creditosContaTeste(): Promise<number> {
  const valor = parseInt(await configPlataforma("creditos_conta_teste", process.env.CREDITOS_CONTA_TESTE), 10);
  return Number.isFinite(valor) && valor >= 0 ? valor : CREDITOS_PADRAO;
}

/** Campos aplicados ao perfil no momento em que ele vira conta de teste. */
export async function camposAtivacaoContaTeste(): Promise<Record<string, unknown>> {
  return { conta_teste: true, ...FLAGS_CONTA_TESTE, creditos: await creditosContaTeste() };
}

export const MSG_CONTA_TESTE_SEM_COMPRA = "Contas de teste não podem fazer compras nem assinaturas. Fale com a equipe pra ativar sua conta.";
