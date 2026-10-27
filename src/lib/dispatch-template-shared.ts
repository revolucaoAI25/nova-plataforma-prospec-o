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

/** Nome aceito pela Meta (minúsculas, números e sublinhado) a partir do nome interno. */
export function nomeMetaDe(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return base || "template";
}

export const NOME_META_VALIDO = /^[a-z0-9_]+$/;

/**
 * Regras da Meta que dá para conferir antes de enviar (o que passar daqui a
 * Meta ainda analisa): nome, variáveis em sequência a partir de {{1}}, sem
 * variável no começo ou no fim do texto, exemplo para cada variável e
 * tamanhos máximos.
 */
export function problemasTemplate(t: {
  nomeMeta: string;
  corpo: string;
  cabecalho?: string;
  rodape?: string;
  exemplos: string[];
  exemploCabecalho?: string;
}): string[] {
  const problemas: string[] = [];
  if (!NOME_META_VALIDO.test(t.nomeMeta)) problemas.push("O nome na Meta só pode ter letras minúsculas, números e sublinhado (_).");
  const corpo = t.corpo.trim();
  if (!corpo) problemas.push("Escreva o texto da mensagem.");
  if (corpo.length > 1024) problemas.push("O texto da mensagem passa de 1.024 caracteres.");
  if (/\{\{\s*[a-zA-Z_]/.test(corpo)) problemas.push("Use variáveis numeradas ({{1}}, {{2}}…). Nomes como {{nome}} não funcionam aqui: o valor de cada número é escolhido na etapa da campanha.");
  const numeros = extrairParametrosTemplate(corpo);
  if (numeros.some((n, i) => n !== i + 1)) problemas.push("As variáveis precisam estar em sequência, começando em {{1}} ({{1}}, {{2}}, {{3}}…).");
  if (/^\{\{\s*\d+\s*\}\}/.test(corpo) || /\{\{\s*\d+\s*\}\}[\s.!?]*$/.test(corpo)) {
    problemas.push("A Meta não aceita variável no começo nem no fim do texto. Ex.: em vez de \"{{1}}, tudo bem?\", use \"Olá, {{1}}, tudo bem?\".");
  }
  numeros.forEach((n, i) => {
    if (!t.exemplos[i]?.trim()) problemas.push(`Preencha um exemplo para {{${n}}} (é o que a Meta vê na análise).`);
  });
  if (t.cabecalho) {
    if (t.cabecalho.length > 60) problemas.push("O cabeçalho passa de 60 caracteres.");
    const vars = extrairParametrosTemplate(t.cabecalho);
    if (vars.length > 1 || (vars.length === 1 && vars[0] !== 1)) problemas.push("O cabeçalho aceita no máximo uma variável, {{1}}.");
    if (vars.length === 1 && !t.exemploCabecalho?.trim()) problemas.push("Preencha o exemplo da variável do cabeçalho.");
  }
  if (t.rodape && t.rodape.length > 60) problemas.push("O rodapé passa de 60 caracteres.");
  if (t.rodape && /\{\{/.test(t.rodape)) problemas.push("O rodapé não aceita variáveis.");
  return problemas;
}
