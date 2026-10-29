/**
 * Markdown dos artigos do blog → HTML. Cobre só o que os artigos usam
 * (títulos, parágrafos, listas, tabelas, citações, separador, negrito,
 * itálico, código e links), sem dependência externa. Roda no build: as
 * páginas do blog são estáticas.
 *
 * Extras:
 * - `:::cta` numa linha sozinha marca onde entra a chamada para o produto;
 * - `> **Dica:** ...` (ou Atenção, Exemplo, Na prática) vira um quadro em destaque;
 * - a seção "## Perguntas frequentes" (### pergunta + resposta) alimenta o FAQPage.
 */

export interface Titulo {
  nivel: 2 | 3;
  texto: string;
  id: string;
}

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export type Bloco = { tipo: "html"; html: string } | { tipo: "cta" };

export interface Renderizado {
  blocos: Bloco[];
  titulos: Titulo[];
  perguntas: Pergunta[];
  palavras: number;
}

const QUADROS: Record<string, string> = {
  dica: "dica",
  atenção: "atencao",
  atencao: "atencao",
  exemplo: "exemplo",
  "na prática": "pratica",
  importante: "atencao",
  resumo: "dica",
};

export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Texto puro de um trecho com marcação inline (para FAQ, sumário e contagem de palavras). */
export function textoPuro(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function inline(s: string): string {
  const codigos: string[] = [];
  let r = s.replace(/`([^`]+)`/g, (_, c: string) => {
    codigos.push(`<code>${escapar(c)}</code>`);
    return `\u0000${codigos.length - 1}\u0000`;
  });
  r = escapar(r);
  r = r.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, texto: string, url: string) => {
    const externo = /^https?:\/\//.test(url);
    const attrs = externo ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${url}"${attrs}>${texto}</a>`;
  });
  r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  r = r.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  r = r.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codigos[Number(i)]);
  return r;
}

function celulas(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function renderizarMarkdown(md: string): Renderizado {
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  const titulos: Titulo[] = [];
  const perguntas: Pergunta[] = [];
  const idsUsados = new Map<string, number>();
  let html = "";
  let palavras = 0;
  let naFaq = false;
  let perguntaAtual: Pergunta | null = null;

  const contar = (t: string) => {
    palavras += textoPuro(t).split(/\s+/).filter(Boolean).length;
  };
  const fecharPergunta = () => {
    if (perguntaAtual && perguntaAtual.resposta) perguntas.push({ ...perguntaAtual, resposta: perguntaAtual.resposta.trim() });
    perguntaAtual = null;
  };
  const idUnico = (texto: string) => {
    const base = slugificar(textoPuro(texto)) || "secao";
    const n = idsUsados.get(base) ?? 0;
    idsUsados.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };

  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    const t = linha.trim();

    if (!t) {
      i++;
      continue;
    }

    if (t === ":::cta") {
      if (html) blocos.push({ tipo: "html", html });
      html = "";
      blocos.push({ tipo: "cta" });
      i++;
      continue;
    }

    const h = /^(#{2,4})\s+(.+)$/.exec(t);
    if (h) {
      const nivel = h[1].length;
      const texto = h[2].trim();
      contar(texto);
      if (nivel === 2) {
        fecharPergunta();
        naFaq = /^perguntas frequentes/i.test(textoPuro(texto));
      }
      if (nivel === 3 && naFaq) {
        fecharPergunta();
        perguntaAtual = { pergunta: textoPuro(texto), resposta: "" };
      }
      const id = idUnico(texto);
      if (nivel === 2 || nivel === 3) titulos.push({ nivel: nivel as 2 | 3, texto: textoPuro(texto), id });
      html += `<h${nivel} id="${id}">${inline(texto)}</h${nivel}>\n`;
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(t)) {
      html += "<hr />\n";
      i++;
      continue;
    }

    // Tabela: linha com | seguida da linha separadora |---|
    if (t.startsWith("|") && i + 1 < linhas.length && /^\|?\s*:?-{2,}/.test(linhas[i + 1].trim())) {
      const cab = celulas(t);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && linhas[i].trim().startsWith("|")) {
        corpo.push(celulas(linhas[i]));
        i++;
      }
      cab.forEach(contar);
      corpo.flat().forEach(contar);
      html +=
        `<div class="tabela"><table><thead><tr>${cab.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
        corpo.map((l) => `<tr>${l.map((c, j) => (j === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`).join("") +
        "</tbody></table></div>\n";
      continue;
    }

    if (t.startsWith(">")) {
      const partes: string[] = [];
      while (i < linhas.length && linhas[i].trim().startsWith(">")) {
        partes.push(linhas[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const texto = partes.join(" ").trim();
      contar(texto);
      const rotulo = /^\*\*([^*:]+):\*\*\s*/.exec(texto);
      const classe = rotulo ? QUADROS[rotulo[1].trim().toLowerCase()] : undefined;
      if (rotulo && classe) {
        html += `<aside class="quadro quadro-${classe}"><p><strong>${escapar(rotulo[1].trim())}</strong> ${inline(texto.slice(rotulo[0].length))}</p></aside>\n`;
      } else {
        html += `<blockquote><p>${inline(texto)}</p></blockquote>\n`;
      }
      if (perguntaAtual) perguntaAtual.resposta += ` ${textoPuro(texto)}`;
      continue;
    }

    const ehItem = (l: string) => /^\s*([-*]|\d+[.)])\s+/.test(l);
    if (ehItem(linha)) {
      const ordenada = /^\s*\d+[.)]\s+/.test(linha);
      const itens: string[] = [];
      while (i < linhas.length && (ehItem(linhas[i]) || (linhas[i].startsWith("  ") && linhas[i].trim() && itens.length))) {
        if (ehItem(linhas[i])) itens.push(linhas[i].replace(/^\s*([-*]|\d+[.)])\s+/, "").trim());
        else itens[itens.length - 1] += ` ${linhas[i].trim()}`;
        i++;
      }
      itens.forEach(contar);
      const tag = ordenada ? "ol" : "ul";
      html += `<${tag}>${itens.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>\n`;
      if (perguntaAtual) perguntaAtual.resposta += ` ${itens.map(textoPuro).join("; ")}.`;
      continue;
    }

    // Parágrafo: junta linhas até uma vazia ou o começo de outro bloco.
    const partes: string[] = [];
    while (i < linhas.length) {
      const l = linhas[i].trim();
      if (!l || /^#{2,4}\s/.test(l) || l.startsWith(">") || l.startsWith("|") || ehItem(linhas[i]) || l === ":::cta" || /^(-{3,}|\*{3,})$/.test(l)) break;
      partes.push(l);
      i++;
    }
    const texto = partes.join(" ");
    contar(texto);
    html += `<p>${inline(texto)}</p>\n`;
    if (perguntaAtual) perguntaAtual.resposta += ` ${textoPuro(texto)}`;
  }

  fecharPergunta();
  if (html) blocos.push({ tipo: "html", html });
  return { blocos, titulos, perguntas, palavras };
}
