import type { Metadata } from "next";
import { carregarPlanosPublicos } from "@/lib/planos-publicos";
import { Cabecalho } from "@/components/lp/cabecalho";
import { Hero } from "@/components/lp/hero";
import { Historia } from "@/components/lp/historia";
import { Semana } from "@/components/lp/semana";
import { Calculadora } from "@/components/lp/calculadora";
import { Recursos } from "@/components/lp/recursos";
import { Planos } from "@/components/lp/planos";
import { SemTrafego } from "@/components/lp/sem-trafego";
import { Enriquecimento } from "@/components/lp/enriquecimento";
import { Comparativo } from "@/components/lp/comparativo";
import { Clientes } from "@/components/lp/clientes";
import { ChamadaFinal, Duvidas, PERGUNTAS, Rodape } from "@/components/lp/fechamento";
import { PausaForaDaTela } from "@/components/lp/pausa-fora-da-tela";
import { ChamadaMeio } from "@/components/lp/chamada-meio";
import { linkWhatsApp } from "@/components/lp/dados";
import { FONTES_LP } from "./fontes";
import "./lp.css";

// Planos e custos mudam pelo painel admin; a página se atualiza a cada 10 min.
export const revalidate = 600;

const titulo = "Leadmatic · Reuniões qualificadas na sua agenda, toda semana";
const descricao =
  "O Leadmatic encontra empresas com o perfil do seu cliente ideal, identifica quem decide, conduz a abordagem por WhatsApp, e-mail e LinkedIn e avisa quando alguém responde.";

export const metadata: Metadata = {
  title: { absolute: titulo },
  description: descricao,
  alternates: { canonical: "/conheca" },
  openGraph: { title: titulo, description: descricao, type: "website", locale: "pt_BR" },
  twitter: { card: "summary_large_image", title: titulo, description: descricao },
};

export default async function ConhecaPage() {
  const { planos, creditosPorLead } = await carregarPlanosPublicos();
  // Menor custo, nos planos, de uma empresa com o telefone conferido (para o comparativo com o tráfego pago).
  const custos = planos.filter((p) => p.creditosMes > 0).map((p) => (p.precoMes / p.creditosMes) * creditosPorLead);
  const custoEmpresa = custos.length ? Math.min(...custos) : null;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PERGUNTAS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  return (
    <div className={`lp ${FONTES_LP} relative min-h-screen w-full`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Cabecalho />
      <main>
        <Hero />
        <SemTrafego custoEmpresa={custoEmpresa} />
        <div className="py-12 sm:py-16">
          <ChamadaMeio
            frase="Comece a prospectar sem depender de anúncio."
            principal={{ rotulo: "Ver planos", href: "#planos" }}
            secundario={{ rotulo: "Testar grátis", href: "/teste-gratis" }}
          />
        </div>
        <Historia />
        <Enriquecimento />
        <ChamadaMeio
          frase="Quanto isso pode render para a sua empresa?"
          principal={{ rotulo: "Simular meu resultado", href: "#conta" }}
          secundario={{ rotulo: "Ver planos", href: "#planos" }}
        />
        <Calculadora planos={planos} creditosPorLead={creditosPorLead} />
        <Semana />
        <div className="py-12 sm:py-16">
          <ChamadaMeio
            frase="Quer essa semana na sua empresa?"
            principal={{ rotulo: "Começar agora", href: "#planos" }}
            secundario={{ rotulo: "Falar no WhatsApp", href: linkWhatsApp(), externo: true }}
          />
        </div>
        <Recursos />
        <Comparativo planos={planos} />
        <Clientes />
        <Planos planos={planos} />
        <Duvidas />
        <ChamadaFinal />
      </main>
      <Rodape />
      <PausaForaDaTela />
    </div>
  );
}
