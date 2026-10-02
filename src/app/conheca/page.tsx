import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Instrument_Serif } from "next/font/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_FEATURE_FLAG_KEYS, type PlanFeatureFlags, type PlanRow } from "@/lib/database.types";
import { Cabecalho } from "@/components/lp/cabecalho";
import { Hero } from "@/components/lp/hero";
import { Manifesto } from "@/components/lp/manifesto";
import { Historia } from "@/components/lp/historia";
import { Semana } from "@/components/lp/semana";
import { Calculadora } from "@/components/lp/calculadora";
import { Recursos } from "@/components/lp/recursos";
import { Planos } from "@/components/lp/planos";
import { ChamadaFinal, Duvidas, PERGUNTAS, Rodape } from "@/components/lp/fechamento";
import type { PlanoLP } from "@/components/lp/dados";
import "./lp.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

// Planos e custos mudam pelo painel admin; a página se atualiza a cada 10 min.
export const revalidate = 600;

const titulo = "Prospecção Ativa · Reunião marcada toda semana, sem caçar cliente";
const descricao =
  "A plataforma encontra empresas com cara de cliente seu, descobre quem decide, manda a primeira mensagem e as próximas por WhatsApp, e-mail e LinkedIn, e te avisa quando alguém responde.";

export const metadata: Metadata = {
  title: { absolute: titulo },
  description: descricao,
  alternates: { canonical: "/conheca" },
  openGraph: { title: titulo, description: descricao, type: "website", locale: "pt_BR" },
  twitter: { card: "summary_large_image", title: titulo, description: descricao },
};

const ROTULO_RECURSO: Record<keyof PlanFeatureFlags, string> = {
  disparo_habilitado: "Disparo por WhatsApp",
  email_disparo_habilitado: "Disparo por e-mail",
  linkedin_disparo_habilitado: "Disparo por LinkedIn",
  instagram_visible: "Leads do Instagram",
  linkedin_visible: "Leads do LinkedIn",
  enriquecimento_ia_habilitado: "Enriquecimento com IA",
  bigdatacorp_enrichment_habilitado: "Contato do decisor (enriquecimento avançado)",
};

/** Créditos de uma empresa com contato conferido: busca por CNPJ + verificação no Maps. */
const CREDITOS_POR_LEAD_PADRAO = 6;

async function carregarDados(): Promise<{ planos: PlanoLP[]; creditosPorLead: number }> {
  try {
    const sb = createAdminClient();
    const [{ data: planos }, { data: custos }] = await Promise.all([
      sb.from("plans").select("*").eq("ativo", true).order("ordem"),
      sb.from("credit_costs").select("acao, custo").in("acao", ["cnpj", "cnpj_maps_extra"]),
    ]);
    const soma = (custos ?? []).reduce((t, c) => t + Number(c.custo || 0), 0);
    return {
      creditosPorLead: soma > 0 ? soma : CREDITOS_POR_LEAD_PADRAO,
      planos: ((planos ?? []) as PlanRow[]).map((p) => ({
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        precoMes: p.preco_centavos / 100,
        precoAnual: p.preco_anual_centavos ? p.preco_anual_centavos / 100 : null,
        creditosMes: p.creditos_mensais,
        recursos: PLAN_FEATURE_FLAG_KEYS.filter((k) => p[k]).map((k) => ROTULO_RECURSO[k]),
      })),
    };
  } catch {
    // Sem banco (build local, env faltando): a página sai sem preços e com o CTA de contato.
    return { planos: [], creditosPorLead: CREDITOS_POR_LEAD_PADRAO };
  }
}

export default async function ConhecaPage() {
  const { planos, creditosPorLead } = await carregarDados();
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PERGUNTAS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  return (
    <div className={`lp ${bricolage.variable} ${instrument.variable} ${geistMono.variable} relative min-h-screen w-full`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Cabecalho />
      <main>
        <Hero />
        <Manifesto />
        <Historia />
        <Semana />
        <Calculadora planos={planos} creditosPorLead={creditosPorLead} />
        <Recursos />
        <Planos planos={planos} creditosPorLead={creditosPorLead} />
        <Duvidas />
        <ChamadaFinal />
      </main>
      <Rodape />
    </div>
  );
}
