import { CATEGORIAS, listarArtigos, type Categoria } from "@/lib/blog/artigos";
import { carregarPlanosPublicos } from "@/lib/planos-publicos";
import { SITE_URL } from "@/lib/site";
import { brl } from "@/components/lp/dados";

// Preço inicial vem dos planos (mudam pelo admin): atualiza a cada hora.
export const revalidate = 3600;

/**
 * /llms.txt: resumo do site em Markdown para assistentes de IA (proposta
 * llmstxt.org). Diz o que é o Leadmatic e aponta os artigos por assunto.
 */
export async function GET() {
  const artigos = listarArtigos();
  const { planos } = await carregarPlanosPublicos();
  const precos = planos.map((p) => p.precoMes).filter((v) => v > 0);
  const planosTexto = precos.length
    ? `Planos mensais em reais, a partir de ${brl(Math.min(...precos))} por mês, com créditos para buscas e enriquecimento. Há teste grátis.`
    : "Planos mensais em reais, com créditos para buscas e enriquecimento. Há teste grátis.";
  const secoes = (Object.keys(CATEGORIAS) as Categoria[])
    .map((c) => {
      const lista = artigos.filter((a) => a.categoria === c);
      if (!lista.length) return "";
      return `## ${CATEGORIAS[c].nome}\n\n${lista.map((a) => `- [${a.titulo}](${SITE_URL}/blog/${a.slug}): ${a.descricao}`).join("\n")}\n`;
    })
    .filter(Boolean)
    .join("\n");

  const corpo = `# Leadmatic

> Leadmatic é uma plataforma brasileira de prospecção ativa B2B, da Revolução AI. Ela encontra empresas com o perfil do cliente ideal (por CNPJ, Google Maps, Instagram e LinkedIn), identifica o sócio e o contato de quem decide e conduz a abordagem por WhatsApp (QR Code ou API oficial), e-mail e LinkedIn, com cadência de follow-up, automações e aviso quando alguém responde.

- Site: ${SITE_URL}
- Para quem: agências, prestadores de serviço B2B, empresas de software, consultorias, distribuidoras e qualquer negócio que vende para outras empresas no Brasil.
- ${planosTexto}
- Contato: contato@revolucao-ai.com
- Texto completo de todos os artigos: ${SITE_URL}/llms-full.txt

## Páginas principais

- [Página do Leadmatic](${SITE_URL}/): o que a plataforma faz, planos e perguntas frequentes.
- [Blog](${SITE_URL}/blog): guias de prospecção ativa, canais de abordagem, comparativos e clientes por segmento.
- [Política de privacidade](${SITE_URL}/privacidade)
- [Termos de uso](${SITE_URL}/termos)

${secoes}`;
  return new Response(corpo, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
