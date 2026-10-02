import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_FEATURE_FLAG_KEYS, type PlanFeatureFlags, type PlanRow } from "@/lib/database.types";
import type { PlanoLP } from "@/components/lp/dados";

/** Planos ativos e custo de créditos por empresa, para a página de vendas e a contratação (só servidor). */
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

export async function carregarPlanosPublicos(): Promise<{ planos: PlanoLP[]; creditosPorLead: number }> {
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

