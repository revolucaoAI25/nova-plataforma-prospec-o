/**
 * Interpolação de variáveis nos campos de configuração dos nós — estilo
 * Make/N8N, mas escopo enxuto: os nós do fluxo rodam UMA VEZ por execução
 * (não uma vez por lead), então não há como interpolar "por lead" de
 * verdade nos campos de config; o que dá pra oferecer sem reescrever o
 * motor é:
 *
 *  - `{{variaveis.nome}}` — parâmetros de entrada declarados no nó de
 *    gatilho manual (ver gatilhoManualConfigSchema), preenchidos a cada
 *    "Executar agora". Em runs de outros gatilhos (agendado, planilha,
 *    filtro de leads) fica sempre vazio — o token permanece como está.
 *  - `{{lead.campo}}` — campo do PRIMEIRO lead do lote atual. Só resolve a
 *    partir do nó seguinte a uma extração/enriquecimento que já produziu
 *    lote (no primeiro nó de extração do fluxo, `lote` ainda está vazio).
 *
 * Token que não resolve fica intacto no texto (visível, fácil de notar e
 * corrigir) em vez de virar string vazia silenciosamente.
 */

export interface FlowInterpolacaoContexto {
  variaveis: Record<string, string>;
  lote: Array<Record<string, unknown>>;
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s*\}\}/g;

function resolverToken(caminho: string, ctx: FlowInterpolacaoContexto): string | undefined {
  const ponto = caminho.indexOf(".");
  const namespace = caminho.slice(0, ponto);
  const campo = caminho.slice(ponto + 1);

  if (namespace === "variaveis") {
    const valor = ctx.variaveis[campo];
    return valor !== undefined ? valor : undefined;
  }
  if (namespace === "lead") {
    const primeiro = ctx.lote[0];
    if (!primeiro || primeiro[campo] === undefined || primeiro[campo] === null) return undefined;
    return String(primeiro[campo]);
  }
  return undefined;
}

export function interpolarTexto(texto: string, ctx: FlowInterpolacaoContexto): string {
  if (!texto.includes("{{")) return texto;
  return texto.replace(TOKEN_RE, (match, caminho: string) => {
    const valor = resolverToken(caminho, ctx);
    return valor !== undefined ? valor : match;
  });
}

/** Aplica interpolarTexto em toda string (e cada item de string[]) de um objeto de config — demais tipos passam intactos. */
export function interpolarConfig<T extends Record<string, unknown>>(config: T, ctx: FlowInterpolacaoContexto): T {
  const out: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(config)) {
    if (typeof valor === "string") {
      out[chave] = interpolarTexto(valor, ctx);
    } else if (Array.isArray(valor) && valor.every((v) => typeof v === "string")) {
      out[chave] = valor.map((v) => interpolarTexto(v, ctx));
    } else {
      out[chave] = valor;
    }
  }
  return out as T;
}
