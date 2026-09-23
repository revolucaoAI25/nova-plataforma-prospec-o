// Parte pura (sem dependência de servidor) do canal oficial — extrai os
// placeholders posicionais {{1}}, {{2}}... de um corpo de template Meta.
// Usada tanto ao criar o template (deriva `variaveis` automaticamente, sem
// precisar que o admin digite o número de parâmetros à parte) quanto ao
// montar uma etapa de campanha com esse template (sabe quantos campos de
// parâmetro mostrar, na ordem certa — a API do WhatsApp trata o array de
// parâmetros como posicional: índice 0 = {{1}}, índice 1 = {{2}}, etc.).
export function extrairParametrosTemplate(corpo: string): number[] {
  const numeros = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corpo))) numeros.add(Number(m[1]));
  return Array.from(numeros).sort((a, b) => a - b);
}
