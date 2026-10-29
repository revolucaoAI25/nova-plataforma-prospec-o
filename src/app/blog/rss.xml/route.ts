import { CATEGORIAS, listarArtigos } from "@/lib/blog/artigos";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const data = (iso: string) => new Date(`${iso}T12:00:00-03:00`).toUTCString();

/** Feed RSS do blog (leitores de feed e alguns buscadores descobrem artigos novos por aqui). */
export function GET() {
  const artigos = listarArtigos();
  const itens = artigos
    .map(
      (a) => `    <item>
      <title>${xml(a.titulo)}</title>
      <link>${SITE_URL}/blog/${a.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${a.slug}</guid>
      <description>${xml(a.descricao)}</description>
      <category>${xml(CATEGORIAS[a.categoria].nome)}</category>
      <pubDate>${data(a.publicado)}</pubDate>
    </item>`,
    )
    .join("\n");
  const corpo = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog do Leadmatic</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Prospecção ativa, geração de clientes B2B e comparativos de ferramentas.</description>
    <language>pt-BR</language>
    <lastBuildDate>${artigos[0] ? data(artigos.reduce((m, a) => (a.atualizado > m ? a.atualizado : m), artigos[0].atualizado)) : new Date().toUTCString()}</lastBuildDate>
${itens}
  </channel>
</rss>
`;
  return new Response(corpo, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
