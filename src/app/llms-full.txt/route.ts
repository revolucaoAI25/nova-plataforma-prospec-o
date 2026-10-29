import { CATEGORIAS, formatarData, listarArtigos } from "@/lib/blog/artigos";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** /llms-full.txt: o texto completo dos artigos em Markdown, para assistentes de IA lerem de uma vez. */
export function GET() {
  const corpo = [
    "# Blog do Leadmatic: textos completos",
    "",
    `> Artigos sobre prospecção ativa e geração de clientes B2B publicados em ${SITE_URL}/blog. Cada artigo traz o endereço original para citação.`,
    "",
    ...listarArtigos().map((a) =>
      [
        "---",
        "",
        `# ${a.titulo}`,
        "",
        `Endereço: ${SITE_URL}/blog/${a.slug}`,
        `Categoria: ${CATEGORIAS[a.categoria].nome} · Atualizado em ${formatarData(a.atualizado)}`,
        "",
        `> ${a.descricao}`,
        "",
        ...(a.resumo.length ? ["Em resumo:", ...a.resumo.map((r) => `- ${r}`), ""] : []),
        a.corpo.replace(/^:::cta\s*$/gm, "").replace(/\]\(\/blog\//g, `](${SITE_URL}/blog/`).trim(),
        "",
      ].join("\n"),
    ),
  ].join("\n");
  return new Response(corpo, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
