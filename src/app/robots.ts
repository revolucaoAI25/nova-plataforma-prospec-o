import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Buscadores e assistentes de IA podem ler a página de vendas e o blog
 * (ser citado no ChatGPT, Perplexity, Gemini e Copilot depende disso).
 * As telas internas e as APIs ficam fora.
 */
const FORA = ["/api/", "/auth/", "/login", "/assinar", "/bem-vindo", "/redefinir-senha", "/admin"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: FORA },
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "GPTBot",
          "PerplexityBot",
          "Perplexity-User",
          "ClaudeBot",
          "Claude-User",
          "Claude-SearchBot",
          "Google-Extended",
          "Applebot",
          "Applebot-Extended",
          "DuckDuckBot",
          "meta-externalagent",
        ],
        allow: "/",
        disallow: FORA,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
