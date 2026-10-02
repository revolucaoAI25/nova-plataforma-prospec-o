import type { Metadata } from "next";
import { carregarPlanosPublicos } from "@/lib/planos-publicos";
import { Cabecalho } from "@/components/lp/cabecalho";
import { Hero } from "@/components/lp/hero";
import { Manifesto } from "@/components/lp/manifesto";
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
        <Manifesto />
        <SemTrafego />
        <Historia />
        <Enriquecimento />
        <Semana />
        <Calculadora planos={planos} creditosPorLead={creditosPorLead} />
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
