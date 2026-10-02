import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_FEATURE_FLAG_KEYS, type PlanFeatureFlags, type PlanRow } from "@/lib/database.types";
import { num, type PlanoLP } from "@/components/lp/dados";

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

/**
 * Fontes de extração, na ordem de preferência em caso de empate de custo.
 * CNPJ e Maps entram em todo plano; Instagram e LinkedIn dependem da flag.
 */
const FONTES: { acao: string; rotulo: string; flag?: keyof PlanFeatureFlags }[] = [
  { acao: "cnpj", rotulo: "busca por CNPJ" },
  { acao: "maps", rotulo: "busca no Google Maps" },
  { acao: "instagram", rotulo: "busca no Instagram", flag: "instagram_visible" },
  { acao: "linkedin", rotulo: "busca no LinkedIn", flag: "linkedin_visible" },
];

/** Fonte de extração mais barata disponível no plano (custo em créditos por empresa). */
function fonteMaisBarata(plano: PlanRow, custos: Map<string, number>): { custo: number; rotulo: string } | null {
  let melhor: { custo: number; rotulo: string } | null = null;
  for (const f of FONTES) {
    if (f.flag && !plano[f.flag]) continue;
    const custo = custos.get(f.acao);
    if (!custo || custo <= 0) continue;
    if (!melhor || custo < melhor.custo) melhor = { custo, rotulo: f.rotulo };
  }
  return melhor;
}

export async function carregarPlanosPublicos(): Promise<{ planos: PlanoLP[]; creditosPorLead: number }> {
  try {
    const sb = createAdminClient();
    const [{ data: planos }, { data: custos }] = await Promise.all([
      sb.from("plans").select("*").eq("ativo", true).order("ordem"),
      sb.from("credit_costs").select("acao, custo").in("acao", ["cnpj", "cnpj_maps_extra", ...FONTES.map((f) => f.acao)]),
    ]);
    const custoPorAcao = new Map((custos ?? []).map((c) => [c.acao as string, Number(c.custo || 0)]));
    const soma = (custoPorAcao.get("cnpj") ?? 0) + (custoPorAcao.get("cnpj_maps_extra") ?? 0);
    return {
      creditosPorLead: soma > 0 ? soma : CREDITOS_POR_LEAD_PADRAO,
      planos: ((planos ?? []) as PlanRow[]).map((p) => {
        const fonte = fonteMaisBarata(p, custoPorAcao);
        return {
          id: p.id,
          nome: p.nome,
          descricao: p.descricao,
          precoMes: p.preco_centavos / 100,
          precoAnual: p.preco_anual_centavos ? p.preco_anual_centavos / 100 : null,
          creditosMes: p.creditos_mensais,
          empresasMes: fonte ? Math.floor(p.creditos_mensais / fonte.custo) : null,
          fonteEmpresas: fonte?.rotulo ?? null,
          recursos: PLAN_FEATURE_FLAG_KEYS.filter((k) => p[k]).map((k) =>
            k === "email_disparo_habilitado" && p.email_limite_diario
              ? `${ROTULO_RECURSO[k]} (até ${num(p.email_limite_diario)} por dia)`
              : ROTULO_RECURSO[k],
          ),
        };
      }),
    };
  } catch {
    // Sem banco (build local, env faltando): a página sai sem preços e com o CTA de contato.
    return { planos: [], creditosPorLead: CREDITOS_POR_LEAD_PADRAO };
  }
}
