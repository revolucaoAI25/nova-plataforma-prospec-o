import type { Metadata } from "next";
import { carregarPlanosPublicos } from "@/lib/planos-publicos";
import { Cabecalho } from "@/components/lp/cabecalho";
import { Hero } from "@/components/lp/hero";
import { Historia } from "@/components/lp/historia";
import { Calculadora } from "@/components/lp/calculadora";
import { Planos } from "@/components/lp/planos";
import { SemTrafego } from "@/components/lp/sem-trafego";
import { EntreguePronto } from "@/components/lp/entregue-pronto";
import { Enriquecimento } from "@/components/lp/enriquecimento";
import { Comparativo } from "@/components/lp/comparativo";
import { Clientes } from "@/components/lp/clientes";
import { ChamadaFinal, Duvidas, PERGUNTAS, Rodape } from "@/components/lp/fechamento";
import { PausaForaDaTela } from "@/components/lp/pausa-fora-da-tela";
import { ChamadaMeio } from "@/components/lp/chamada-meio";
import { RastreamentoLP } from "@/components/rastreamento/rastreamento-lp";
import { configRastreamento } from "@/lib/rastreamento/config";
import { FONTES_LP } from "./fontes";
import { EMPRESA_NOME, LOGO_URL, ORGANIZACAO_JSONLD, SITE_URL } from "@/lib/site";
import "./lp.css";

// Planos e custos mudam pelo painel admin; a página se atualiza a cada 10 min.
export const revalidate = 600;

// Título e descrição para o Google e o Bing: o que é (prospecção B2B com IA) e o resultado (reuniões).
const titulo = "Leadmatic: prospecção B2B com IA e reuniões na sua agenda";
const tituloSocial = "Leadmatic · Reuniões qualificadas na sua agenda, toda semana";
const descricao =
  "Plataforma de prospecção ativa B2B: encontra empresas com o perfil do seu cliente ideal, chega no celular do dono e faz a abordagem e o follow-up por WhatsApp, e-mail e LinkedIn. Tudo montado para você.";

export const metadata: Metadata = {
  title: { absolute: titulo },
  description: descricao,
  keywords: [
    "prospecção ativa", "prospecção B2B", "plataforma de prospecção", "ferramenta de prospecção de clientes", "geração de leads B2B",
    "leads qualificados", "prospecção pelo WhatsApp", "lista de empresas por CNPJ", "contato do sócio", "SDR com IA", "automação de vendas",
  ],
  // A raiz do domínio mostra esta página para quem não está logado: o endereço oficial é a raiz.
  alternates: { canonical: "/" },
  openGraph: { title: tituloSocial, description: descricao, type: "website", locale: "pt_BR", url: "/", siteName: "Leadmatic" },
  twitter: { card: "summary_large_image", title: tituloSocial, description: descricao },
};

export default async function ConhecaPage() {
  const [{ planos, creditosPorLead }, rastreio] = await Promise.all([carregarPlanosPublicos(), configRastreamento()]);
  // Menor custo, nos planos, de uma empresa com o telefone conferido (para o comparativo com o tráfego pago).
  const custos = planos.filter((p) => p.creditosMes > 0).map((p) => (p.precoMes / p.creditosMes) * creditosPorLead);
  const custoEmpresa = custos.length ? Math.min(...custos) : null;
  const precos = planos.map((p) => p.precoMes).filter((v) => v > 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZACAO_JSONLD,
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        url: SITE_URL,
        name: "Leadmatic",
        inLanguage: "pt-BR",
        publisher: { "@id": ORGANIZACAO_JSONLD["@id"] },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#produto`,
        name: "Leadmatic",
        url: SITE_URL,
        image: LOGO_URL,
        description: descricao,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Prospecção de clientes B2B",
        operatingSystem: "Web",
        audience: { "@type": "BusinessAudience", audienceType: "Empresas que vendem para outras empresas, de qualquer porte e segmento" },
        inLanguage: "pt-BR",
        publisher: { "@id": ORGANIZACAO_JSONLD["@id"] },
        provider: { "@type": "Organization", name: EMPRESA_NOME },
        featureList: [
          "Busca de empresas por CNPJ, CNAE, Google Maps, Instagram e LinkedIn",
          "Sócio e contato de quem decide em cada empresa",
          "Abordagem e follow-up por WhatsApp, e-mail e LinkedIn",
          "API oficial do WhatsApp ou conexão por QR Code",
          "Estratégia, automações e funil montados por IA",
          "Exportação para Google Sheets e Excel",
        ],
        ...(precos.length
          ? {
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "BRL",
                lowPrice: Math.min(...precos),
                highPrice: Math.max(...precos),
                offerCount: precos.length,
                url: `${SITE_URL}/#planos`,
              },
            }
          : {}),
      },
      {
        "@type": "FAQPage",
        mainEntity: PERGUNTAS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  };

  return (
    <div className={`lp ${FONTES_LP} relative min-h-screen w-full`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RastreamentoLP pixelId={rastreio.pixelId} pagina="vendas" />
      <Cabecalho />
      {/* data-secao: até onde cada visitante rolou e de onde veio cada clique (painel /admin/funil-lp). */}
      <main>
        <div data-secao="inicio"><Hero /></div>
        <div data-secao="sem_trafego"><SemTrafego custoEmpresa={custoEmpresa} /></div>
        <div data-secao="chamada_1" className="py-12 sm:py-16">
          <ChamadaMeio
            frase="Comece a prospectar sem depender de anúncio."
            principal={{ rotulo: "Ver planos", href: "#planos" }}
            secundario={{ rotulo: "Testar grátis", href: "/teste-gratis" }}
          />
        </div>
        <div data-secao="como_funciona"><Historia /></div>
        <div data-secao="enriquecimento"><Enriquecimento /></div>
        <div data-secao="calculadora"><Calculadora planos={planos} creditosPorLead={creditosPorLead} /></div>
        <div data-secao="comparativo"><Comparativo planos={planos} /></div>
        <div data-secao="entregue_pronto"><EntreguePronto /></div>
        <div data-secao="clientes"><Clientes /></div>
        <div data-secao="planos"><Planos planos={planos} /></div>
        <div data-secao="duvidas"><Duvidas /></div>
        <div data-secao="chamada_final"><ChamadaFinal /></div>
      </main>
      <div data-secao="rodape"><Rodape /></div>
      <PausaForaDaTela />
    </div>
  );
}
