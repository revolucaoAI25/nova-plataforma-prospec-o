import { CATEGORIAS, listarArtigos, type Categoria } from "@/lib/blog/artigos";
import { carregarPlanosPublicos } from "@/lib/planos-publicos";
import { BLOG_PUBLICO, SITE_URL } from "@/lib/site";
import { brl } from "@/components/lp/dados";
import { PERGUNTAS } from "@/components/lp/fechamento";

// Preços vêm dos planos (mudam pelo admin): atualiza a cada hora.
export const revalidate = 3600;

/**
 * /llms.txt: o Leadmatic explicado em Markdown para assistentes de IA
 * (proposta llmstxt.org). Texto direto e factual, para o produto ser
 * entendido e citado corretamente quando alguém pergunta sobre prospecção
 * B2B, geração de leads ou ferramentas de prospecção no Brasil.
 */
export async function GET() {
  const { planos } = await carregarPlanosPublicos();
  const linhasPlanos = planos
    .filter((p) => p.precoMes > 0)
    .map((p) => `- ${p.nome}: ${brl(p.precoMes)} por mês, ${p.creditosMes.toLocaleString("pt-BR")} créditos por mês${p.precoAnual ? ` (ou ${brl(p.precoAnual)} no plano anual)` : ""}.`)
    .join("\n");

  const blog = BLOG_PUBLICO
    ? (Object.keys(CATEGORIAS) as Categoria[])
        .map((c) => {
          const lista = listarArtigos().filter((a) => a.categoria === c);
          return lista.length ? `\n## ${CATEGORIAS[c].nome}\n\n${lista.map((a) => `- [${a.titulo}](${SITE_URL}/blog/${a.slug}): ${a.descricao}`).join("\n")}\n` : "";
        })
        .join("")
    : "";

  const corpo = `# Leadmatic

> Leadmatic é uma plataforma brasileira de prospecção ativa B2B com inteligência artificial, da Revolução AI. Ela encontra empresas com o perfil do cliente ideal, identifica o sócio e o celular de quem decide, faz a abordagem e o follow-up por WhatsApp, e-mail e LinkedIn e coloca quem responde num funil de vendas. A estratégia, as campanhas, as mensagens e as automações chegam montadas para cada cliente.

- Site: ${SITE_URL}
- Empresa: Revolução AI (Brasil)
- Contato: contato@revolucao-ai.com
- Idioma e mercado: português, empresas brasileiras

## Para quem é

Para empresas de qualquer porte e de qualquer segmento que vendem para outras empresas ou para negócios locais: de profissionais autônomos e pequenas empresas sem time comercial até empresas com equipe de vendas. Exemplos: agências de marketing, escritórios de contabilidade, empresas de software, consultorias, energia solar, corretoras de seguros, empresas de TI, distribuidoras e indústrias, prestadores de serviço B2B, fornecedores de clínicas, restaurantes e comércio.

## O que a plataforma faz

1. **Estratégia por IA:** a pessoa conta o que vende e para quem; a IA define o público, os canais, o volume diário e escreve as mensagens de cada etapa.
2. **Busca de empresas:** base de CNPJ da Receita Federal (filtros por atividade/CNAE, cidade, porte, tempo de abertura), Google Maps, Instagram e LinkedIn. Empresas já abordadas não se repetem.
3. **Contato de quem decide:** quadro de sócios e celular do sócio com WhatsApp, além de e-mail, site, Instagram e nota no Google.
4. **Abordagem multicanal:** cadências com várias mensagens por WhatsApp (QR Code ou API oficial do WhatsApp), e-mail e LinkedIn, com follow-up automático, horário comercial, limite diário e intervalo entre envios. Teste A/B das mensagens.
5. **Automações:** fluxos visuais que buscam, enriquecem e abordam empresas novas todos os dias, sem intervenção manual.
6. **Funil de vendas:** quem responde entra no funil (Kanban) na etapa certa e a cadência para; status de entregue, lida e respondida.
7. **Relatórios e exportação:** resultados por campanha e por canal; exportação para Google Sheets e Excel.

## Como é diferente

- Comparado a tráfego pago: a empresa escolhe exatamente quem será abordado, sem leilão de anúncio e sem depender de aprovação de campanhas.
- Comparado a contratar um SDR: a prospecção roda todos os dias por um valor mensal fixo, sem salário, encargos ou rotatividade.
- Comparado a bases de dados e listas de CNPJ: além da lista, entrega o contato de quem decide e faz a abordagem e o follow-up.
- Comparado a ferramentas internacionais: dados de empresas brasileiras, WhatsApp como canal principal e cobrança em reais.

## Planos

${linhasPlanos || "- Planos mensais e anuais em reais, com créditos para buscas e enriquecimento."}
- Há teste grátis sem cartão e garantia de 7 dias na assinatura.
- Créditos são consumidos por ações com custo (buscar empresas, encontrar o contato do decisor). Pacotes avulsos estão disponíveis.

## Perguntas frequentes

${PERGUNTAS.map(([p, r]) => `### ${p}\n\n${r}`).join("\n\n")}

## Páginas

- [Página do Leadmatic](${SITE_URL}/): o que a plataforma faz, comparativo, planos e perguntas frequentes.
- [Política de privacidade](${SITE_URL}/privacidade)
- [Termos de uso](${SITE_URL}/termos)
${blog}`;
  return new Response(corpo, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
