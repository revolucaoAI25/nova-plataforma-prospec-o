import { createAdminClient } from "@/lib/supabase/admin";
import type { RastreamentoConta } from "@/lib/database.types";
import type { DadosLead, EtapaLead, LeadRow } from "@/lib/lp-leads-tipos";

/**
 * Leads da página de vendas no quadro do admin (/admin/leads, migration
 * 0049). Um lead por pessoa: achado pela conta, pelo visitante (cookie) ou
 * pelo e-mail, nessa ordem. A etapa só avança; quando avança, o card vai
 * para a coluna da etapa nova (mesmo que estivesse em "Em contato" ou
 * "Perdido"). Nunca derruba quem chama: falhas só vão para o log.
 */

export { COLUNAS_LEAD, type ColunaLead, type DadosLead, type EtapaLead, type LeadRow } from "@/lib/lp-leads-tipos";

const ORDEM: Record<EtapaLead, number> = { preencheu: 0, teste: 1, aguardando_pagamento: 2, cliente: 3 };

const limpa = (v: string | null | undefined, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function registrarLeadLP(p: {
  etapa: EtapaLead;
  userId?: string | null;
  origem?: RastreamentoConta | null;
  dados?: DadosLead;
  /** Só avança um lead que já existe (ex.: quem estava no teste assina por dentro da plataforma). */
  soAtualizar?: boolean;
}): Promise<void> {
  try {
    await gravar(p, true);
  } catch (err) {
    console.error("[lp-leads] não registrou o lead", (err as Error).message);
  }
}

async function gravar(p: Parameters<typeof registrarLeadLP>[0], tentarDeNovo: boolean): Promise<void> {
  const sb = createAdminClient();
  const visitante = limpa(p.origem?.visitante, 80);
  const d = p.dados ?? {};
  const email = limpa(d.email)?.toLowerCase() ?? null;

  let atual: LeadRow | null = null;
  const buscar = async (coluna: string, valor: string) => {
    const q = sb.from("lp_leads").select("*").limit(1);
    const { data } = await q.eq(coluna, valor);
    return ((data ?? [])[0] as LeadRow | undefined) ?? null;
  };
  if (p.userId) atual = await buscar("user_id", p.userId);
  if (!atual && visitante) atual = await buscar("visitante", visitante);
  if (!atual && email) atual = await buscar("email", email);

  const campos: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const [k, v] of Object.entries({ ...d, email })) {
    const valor = limpa(v as string | null);
    // Um preenchimento parcial não apaga o que já se sabe da pessoa.
    if (valor) campos[k] = valor;
  }
  if (p.userId) campos.user_id = p.userId;
  if (visitante && !atual?.visitante) campos.visitante = visitante;
  const o = p.origem;
  if (o && !atual?.utm_source && !atual?.utm_campaign) {
    Object.assign(campos, { utm_source: o.utm_source ?? null, utm_medium: o.utm_medium ?? null, utm_campaign: o.utm_campaign ?? null, utm_content: o.utm_content ?? null });
  }

  if (atual) {
    if (ORDEM[p.etapa] > ORDEM[atual.etapa]) Object.assign(campos, { etapa: p.etapa, coluna: p.etapa, movido_em: campos.atualizado_em });
    const { error } = await sb.from("lp_leads").update(campos).eq("id", atual.id);
    if (error) throw new Error(error.message);
    return;
  }

  if (p.soAtualizar) return;
  const { error } = await sb.from("lp_leads").insert({ ...campos, etapa: p.etapa, coluna: p.etapa });
  // Duas chamadas ao mesmo tempo para a mesma pessoa: a segunda vira atualização.
  if (error?.code === "23505" && tentarDeNovo) return gravar(p, false);
  if (error) throw new Error(error.message);
}
