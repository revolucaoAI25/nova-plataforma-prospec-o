/**
 * Só aceita caminhos internos para redirecionar depois de login ou de um
 * link de e-mail: um destino externo (https://…, //site, /\site) levaria a
 * pessoa para fora (golpe de phishing).
 */
export function caminhoInterno(pedido: string | null | undefined, padrao = "/"): string {
  if (!pedido || !pedido.startsWith("/") || pedido.startsWith("//") || pedido.startsWith("/\\")) return padrao;
  return pedido;
}
