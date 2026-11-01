import type { MetadataRoute } from "next";
import { CATEGORIAS, listarArtigos } from "@/lib/blog/artigos";
import { BLOG_PUBLICO, SITE_URL } from "@/lib/site";

/** Páginas públicas para o Google e o Bing. As telas da plataforma (login para dentro) ficam de fora. */
export default function sitemap(): MetadataRoute.Sitemap {
  const hoje = new Date();
  const paginas: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: hoje, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.2 },
  ];
  if (!BLOG_PUBLICO) return paginas;

  const artigos = listarArtigos();
  return [
    ...paginas,
    { url: `${SITE_URL}/blog`, lastModified: hoje, changeFrequency: "weekly", priority: 0.9 },
    ...Object.keys(CATEGORIAS).map((c) => ({ url: `${SITE_URL}/blog/categoria/${c}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...artigos.map((a) => ({ url: `${SITE_URL}/blog/${a.slug}`, lastModified: a.atualizado, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
