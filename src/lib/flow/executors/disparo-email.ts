import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Placeholder — módulo anunciado no roadmap (visível na paleta, marcado
 * `disponivel: false` em node-types.ts) mas sem infra de envio de e-mail
 * ainda. Existe pra não quebrar um fluxo salvo que o inclua; a UI já
 * impede arrastar/conectar esse nó como executável.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function executarDisparoEmail(_ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  return {
    status: "erro",
    erro: "Disparo por e-mail ainda não está disponível — em breve.",
  };
}
