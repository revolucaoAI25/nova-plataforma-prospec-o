/** Endereço público e dados da marca, para SEO (canonical, sitemap, dados estruturados). */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://leadmatic.revolucao-ai.com").replace(/\/+$/, "");
export const SITE_NOME = "Leadmatic";
export const EMPRESA_NOME = "Revolução AI";
export const EMPRESA_URL = "https://revolucao-ai.com";
export const LOGO_URL = `${SITE_URL}/logo.png`;

export function urlAbsoluta(caminho: string): string {
  return `${SITE_URL}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

/** Organização por trás do produto (JSON-LD), referenciada pelo @id nas outras entidades. */
export const ORGANIZACAO_JSONLD = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organizacao`,
  name: EMPRESA_NOME,
  url: EMPRESA_URL,
  logo: { "@type": "ImageObject", url: LOGO_URL },
  email: "contato@revolucao-ai.com",
  brand: { "@type": "Brand", name: SITE_NOME },
} as const;
