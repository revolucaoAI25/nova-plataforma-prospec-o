import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderizarMarkdown, type Renderizado } from "./markdown";

/**
 * Artigos do blog: um arquivo .md por artigo em content/blog, com um
 * cabeçalho simples entre linhas `---`:
 *
 *   titulo: Prospecção ativa: o guia completo
 *   descricao: Texto curto para o Google (até ~155 caracteres).
 *   categoria: prospeccao
 *   publicado: 2026-10-29
 *   atualizado: 2026-10-29        (opcional)
 *   palavras_chave: prospecção ativa, outbound
 *   destaque: sim                 (opcional: aparece no topo do blog)
 *   resumo:                       (opcional: "Em resumo" no topo do artigo)
 *   - primeiro ponto
 *   - segundo ponto
 *
 * O nome do arquivo é o endereço (prospeccao-ativa.md → /blog/prospeccao-ativa).
 * Também é lido pelo worker (aviso de páginas novas ao Bing), então não usa nada do Next.
 */

export const CATEGORIAS = {
  prospeccao: {
    nome: "Prospecção",
    descricao: "Método, processo e rotina para encontrar empresas com o perfil certo e transformar contatos em reuniões.",
  },
  canais: {
    nome: "WhatsApp, e-mail e LinkedIn",
    descricao: "Como abordar empresas em cada canal: mensagens, cadência, boas práticas e o que dá resposta.",
  },
  comparativos: {
    nome: "Ferramentas e comparativos",
    descricao: "Comparações honestas entre ferramentas, bases de dados e formas de conseguir clientes.",
  },
  gestao: {
    nome: "Gestão comercial",
    descricao: "Métricas, metas, equipe e processos para vender de forma previsível.",
  },
  nichos: {
    nome: "Clientes por segmento",
    descricao: "Guias práticos de como conseguir clientes em cada tipo de negócio B2B.",
  },
} as const;

export type Categoria = keyof typeof CATEGORIAS;

export interface Artigo {
  slug: string;
  titulo: string;
  descricao: string;
  categoria: Categoria;
  publicado: string;
  atualizado: string;
  palavrasChave: string[];
  destaque: boolean;
  resumo: string[];
  corpo: string;
}

const PASTA = join(process.cwd(), "content", "blog");

function lerCabecalho(texto: string): { campos: Record<string, string | string[]>; corpo: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto.replace(/\r\n/g, "\n"));
  if (!m) return { campos: {}, corpo: texto };
  const campos: Record<string, string | string[]> = {};
  let listaAtual: string | null = null;
  for (const linha of m[1].split("\n")) {
    const item = /^\s*-\s+(.+)$/.exec(linha);
    if (item && listaAtual) {
      (campos[listaAtual] as string[]).push(item[1].trim());
      continue;
    }
    const kv = /^([a-z_]+):\s*(.*)$/.exec(linha);
    if (!kv) continue;
    if (kv[2].trim() === "") {
      listaAtual = kv[1];
      campos[kv[1]] = [];
    } else {
      listaAtual = null;
      campos[kv[1]] = kv[2].trim();
    }
  }
  return { campos, corpo: m[2] };
}

let cache: Artigo[] | null = null;

/** Todos os artigos, do mais recente para o mais antigo. */
export function listarArtigos(): Artigo[] {
  if (cache) return cache;
  // Sem a pasta (nenhum artigo publicado ainda), o blog sai vazio em vez de quebrar o build.
  let arquivos: string[] = [];
  try {
    arquivos = readdirSync(PASTA).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  } catch {}
  const artigos = arquivos.map((arquivo) => {
    const { campos, corpo } = lerCabecalho(readFileSync(join(PASTA, arquivo), "utf8"));
    const texto = (k: string) => (typeof campos[k] === "string" ? (campos[k] as string) : "");
    const categoria = texto("categoria") as Categoria;
    if (!(categoria in CATEGORIAS)) throw new Error(`Artigo ${arquivo}: categoria "${categoria}" não existe`);
    const publicado = texto("publicado");
    return {
      slug: arquivo.replace(/\.md$/, ""),
      titulo: texto("titulo"),
      descricao: texto("descricao"),
      categoria,
      publicado,
      atualizado: texto("atualizado") || publicado,
      palavrasChave: texto("palavras_chave").split(",").map((p) => p.trim()).filter(Boolean),
      destaque: /^(sim|true)$/i.test(texto("destaque")),
      resumo: Array.isArray(campos.resumo) ? campos.resumo : [],
      corpo,
    } satisfies Artigo;
  });
  cache = artigos.sort((a, b) => b.publicado.localeCompare(a.publicado) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  return cache;
}

export function buscarArtigo(slug: string): Artigo | undefined {
  return listarArtigos().find((a) => a.slug === slug);
}

const renderizados = new Map<string, Renderizado>();

export function renderizarArtigo(artigo: Artigo): Renderizado {
  let r = renderizados.get(artigo.slug);
  if (!r) {
    r = renderizarMarkdown(artigo.corpo);
    renderizados.set(artigo.slug, r);
  }
  return r;
}

/** Minutos de leitura (≈ 220 palavras por minuto). */
export function minutosDeLeitura(artigo: Artigo): number {
  return Math.max(1, Math.round(renderizarArtigo(artigo).palavras / 220));
}

/** Artigos para "Continue lendo": os da mesma categoria, depois os que este cita, depois os mais recentes. */
export function relacionados(artigo: Artigo, quantos = 3): Artigo[] {
  const todos = listarArtigos().filter((a) => a.slug !== artigo.slug);
  const citados = [...artigo.corpo.matchAll(/\]\(\/blog\/([a-z0-9-]+)/g)].map((m) => m[1]);
  const porCitacao = citados.map((s) => todos.find((a) => a.slug === s)).filter((a): a is Artigo => Boolean(a));
  const mesmaCategoria = todos.filter((a) => a.categoria === artigo.categoria);
  const lista: Artigo[] = [];
  for (const a of [...mesmaCategoria, ...porCitacao, ...todos]) {
    if (!lista.includes(a)) lista.push(a);
    if (lista.length >= quantos) break;
  }
  return lista;
}

export function formatarData(iso: string): string {
  return new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}
