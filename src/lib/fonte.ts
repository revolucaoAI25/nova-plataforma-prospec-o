/**
 * Rótulo da origem de um lead para exibir e exportar. Nunca mostra o
 * fornecedor por trás da busca: leads antigos foram gravados como
 * "Apify Maps", "Casa dos Dados" etc. (a migration 0041 corrige a tabela
 * `leads`, mas cópias guardadas em campanhas, cards e planilhas continuam
 * com o valor antigo).
 */
const POR_FONTE: Record<string, string> = {
  "apify maps": "Maps",
  "google maps": "Maps",
  google_maps: "Maps",
  maps: "Maps",
  "casa dos dados": "CNPJ",
  cnpj: "CNPJ",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

export function rotuloFonte(fonte: unknown): string {
  const t = String(fonte ?? "").trim();
  return POR_FONTE[t.toLowerCase()] ?? t;
}
