import type { MetadataRoute } from "next";
import { CATEGORIAS, listarArtigos } from "@/lib/blog/artigos";
import { SITE_URL } from "@/lib/site";

/** Páginas públicas para o Google e o Bing. As telas da plataforma (login para dentro) ficam de fora. */
export default function sitemap(): MetadataRoute.Sitemap {
  const artigos = listarArtigos();
  const maisRecente = artigos.reduce((m, a) => (a.atualizado > m ? a.atualizado : m), "2026-10-29");
  return [
    { url: SITE_URL, lastModified: maisRecente, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/teste-gratis`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/blog`, lastModified: maisRecente, changeFrequency: "weekly", priority: 0.9 },
    ...Object.keys(CATEGORIAS).map((c) => ({
      url: `${SITE_URL}/blog/categoria/${c}`,
      lastModified: maisRecente,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...artigos.map((a) => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: a.atualizado,
      changeFrequency: "monthly" as const,
      priority: a.destaque ? 0.8 : 0.7,
    })),
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
