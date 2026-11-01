import { buscarArtigo, CATEGORIAS, listarArtigos, minutosDeLeitura } from "@/lib/blog/artigos";
import { imagemOg, TAMANHO_OG } from "@/lib/og";

export const size = TAMANHO_OG;
export const contentType = "image/png";
export const alt = "Artigo do blog do Leadmatic";

export function generateStaticParams() {
  return listarArtigos().map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artigo = buscarArtigo(slug);
  return imagemOg({
    selo: artigo ? CATEGORIAS[artigo.categoria].nome : "Blog",
    titulo: artigo?.titulo ?? "Blog do Leadmatic",
    rodape: artigo ? `Blog do Leadmatic · ${minutosDeLeitura(artigo)} min de leitura` : "Blog do Leadmatic",
  });
}
