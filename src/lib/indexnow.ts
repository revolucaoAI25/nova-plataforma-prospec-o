import { listarArtigos } from "@/lib/blog/artigos";
import { BLOG_PUBLICO, SITE_URL } from "@/lib/site";

/**
 * IndexNow: avisa o Bing (e os outros buscadores do protocolo) sobre
 * páginas novas ou atualizadas, sem esperar o próximo rastreamento. A chave
 * é pública por definição: o arquivo public/<chave>.txt prova que o site é
 * nosso.
 */
export const CHAVE_INDEXNOW = "de4410cef0a5bb2d532c75d3733290b4";

const DIA = 86_400_000;

/**
 * Páginas que valem um aviso a cada deploy: a página de vendas (que muda com
 * frequência) e, com o blog aberto, os artigos publicados ou atualizados nos
 * últimos dias.
 */
export function urlsRecentes(dias = 3, agora = new Date()): string[] {
  if (!BLOG_PUBLICO) return [SITE_URL];
  const limite = new Date(agora.getTime() - dias * DIA).toISOString().slice(0, 10);
  const artigos = listarArtigos().filter((a) => a.atualizado >= limite);
  if (!artigos.length) return [];
  return [SITE_URL, `${SITE_URL}/blog`, ...artigos.map((a) => `${SITE_URL}/blog/${a.slug}`)];
}

export async function avisarIndexNow(urls: string[]): Promise<{ status: number } | null> {
  if (!urls.length) return null;
  const host = new URL(SITE_URL).host;
  const resp = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: CHAVE_INDEXNOW, keyLocation: `${SITE_URL}/${CHAVE_INDEXNOW}.txt`, urlList: urls.slice(0, 10_000) }),
    signal: AbortSignal.timeout(20_000),
  });
  return { status: resp.status };
}
