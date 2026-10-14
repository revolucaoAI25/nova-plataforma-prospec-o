import { chaveTelefone } from "@/lib/contatos";
import type { FiltroOperador } from "../node-types";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

// Comparação entre campos ignora a formatação de telefone: "(11) 99999-0002"
// e "5511999990002" são o mesmo número.
function normalizar(v: unknown): string {
  const texto = String(v ?? "").trim().toLowerCase();
  if (/^[\d\s()+\-.]+$/.test(texto)) return chaveTelefone(texto) ?? texto.replace(/\D/g, "");
  return texto;
}

function bateCondicao(lead: Record<string, unknown>, campo: string, operador: FiltroOperador, valorEsperado: string): boolean {
  const valorCampo = lead[campo];
  const texto = String(valorCampo ?? "").trim();
  const alvo = valorEsperado.trim();
  switch (operador) {
    // Compara com outro campo do próprio lead (ex.: telefone diferente de
    // contato_que_falhou, depois de um enriquecimento num ramo "Falhou").
    case "igual_ao_campo":
      return normalizar(valorCampo) === normalizar(lead[alvo]);
    case "diferente_do_campo":
      return normalizar(valorCampo) !== normalizar(lead[alvo]);
    case "preenchido":
      return texto.length > 0;
    case "vazio":
      return texto.length === 0;
    case "contem":
      return texto.toLowerCase().includes(alvo.toLowerCase());
    case "nao_contem":
      return !texto.toLowerCase().includes(alvo.toLowerCase());
    case "igual":
      return texto.toLowerCase() === alvo.toLowerCase();
    case "diferente":
      return texto.toLowerCase() !== alvo.toLowerCase();
    default:
      return true;
  }
}

/**
 * Separa o lote pela condição: quem bate segue pela saída principal
 * ("Atende"); quem não bate sai por "Não atende" se essa saída estiver
 * ligada a algum passo, ou é descartado. Útil depois de um enriquecimento
 * (ex.: seguir só com `enriquecimento_status = concluido`) ou pra qualquer
 * outro corte (`email` preenchido antes de um disparo, `porte` igual a
 * "EMPRESA DE PEQUENO PORTE" pra tratar os maiores de outro jeito, etc.).
 */
export async function executarFiltroLeads(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { node, contexto, saidasConectadas } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const campo = String(config.campo || "").trim();
  const operador = (config.operador as FiltroOperador) || "preenchido";
  const valor = String(config.valor || "");
  if (!campo) return { status: "erro", erro: "Informe o campo a filtrar (ex.: email, enriquecimento_status)." };

  const lote = contexto.lote || [];
  const filtrados: typeof lote = [];
  const naoAtendem: typeof lote = [];
  for (const lead of lote) (bateCondicao(lead, campo, operador, valor) ? filtrados : naoAtendem).push(lead);

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: filtrados.length,
    detalhe: { campo, operador, valor, removidos: naoAtendem.length },
    contextoPatch: { lote: filtrados },
    saidas: saidasConectadas.includes("nao_atende") ? { nao_atende: naoAtendem } : undefined,
  };
}
