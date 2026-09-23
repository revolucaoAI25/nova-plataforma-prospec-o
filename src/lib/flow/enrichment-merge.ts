import type { EnrichmentLeadRow } from "@/lib/database.types";
import { apenasDigitos } from "@/lib/phone";

/**
 * Onde os dados do enriquecimento via IA vão: em vez de ficarem isolados em
 * `enrichment_leads` (como no uso avulso de /enriquecimento, que nunca
 * escreve de volta em `leads`), aqui eles são mesclados DENTRO do lote do
 * fluxo — os mesmos objetos que já circulam entre os nós. Isso resolve as
 * duas perguntas de uma vez: "onde entram os dados enriquecidos" (nos
 * mesmos leads, como campos novos) e "pra qual planilha vão" (qualquer
 * `destino_sheets` depois desse nó já exporta esses campos automaticamente
 * — inclusive a MESMA planilha de origem, se for esse o destino escolhido).
 */
export const ENRIQUECIMENTO_LABELS: Record<string, string> = {
  enriquecimento_status: "Enriquecimento — Status",
  enriquecimento_empresa: "Enriquecimento — Empresa",
  enriquecimento_cargo: "Enriquecimento — Cargo",
  enriquecimento_cnpj: "Enriquecimento — CNPJ",
  enriquecimento_municipio: "Enriquecimento — Município",
  enriquecimento_uf: "Enriquecimento — UF",
  enriquecimento_website: "Enriquecimento — Site",
  enriquecimento_linkedin_url: "Enriquecimento — LinkedIn",
  enriquecimento_resumo: "Enriquecimento — Resumo",
  enriquecimento_socios: "Enriquecimento — Sócios",
  enriquecimento_fundacao: "Enriquecimento — Fundação",
  enriquecimento_processos: "Enriquecimento — Processos (indício)",
};

function normEmail(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

function chaveDeIdentidade(nome: unknown, email: unknown, telefone: unknown): string {
  const e = normEmail(email);
  if (e) return `email:${e}`;
  const t = apenasDigitos(String(telefone || ""));
  if (t) return `tel:${t}`;
  return `nome:${String(nome || "").trim().toLowerCase()}`;
}

/**
 * Mescla os resultados de uma execução de enriquecimento (`enrichment_leads`)
 * de volta no lote de leads do fluxo, casando por e-mail (senão telefone,
 * senão nome — mesma prioridade usada ao montar o lote enviado pra IA).
 * Itens do lote sem correspondência (não entraram no lote enviado, ex.: sem
 * e-mail nem telefone) ficam sem os campos `enriquecimento_*`.
 */
export function mesclarEnriquecimentoNoLote(
  lote: Array<Record<string, unknown>>,
  enrichmentLeads: EnrichmentLeadRow[],
): Array<Record<string, unknown>> {
  const porChave = new Map<string, EnrichmentLeadRow>();
  for (const el of enrichmentLeads) {
    porChave.set(chaveDeIdentidade(el.nome_lead, el.email, el.telefone), el);
  }

  return lote.map((lead) => {
    const chave = chaveDeIdentidade(lead.nome, lead.email, lead.telefone);
    const resultado = porChave.get(chave);
    if (!resultado) return lead;

    const extras: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(resultado.extras || {})) {
      extras[`enriquecimento_extra_${campo}`] = valor;
    }

    return {
      ...lead,
      enriquecimento_status: resultado.status,
      enriquecimento_empresa: resultado.empresa_nome || "",
      enriquecimento_cargo: resultado.cargo || "",
      enriquecimento_cnpj: resultado.cnpj || "",
      enriquecimento_municipio: resultado.municipio || "",
      enriquecimento_uf: resultado.uf || "",
      enriquecimento_website: resultado.website || "",
      enriquecimento_linkedin_url: resultado.linkedin_url || "",
      enriquecimento_resumo: resultado.resumo || "",
      enriquecimento_socios: resultado.socios || "",
      enriquecimento_fundacao: resultado.fundacao || "",
      enriquecimento_processos: resultado.processos_jusbrasil || "",
      ...extras,
    };
  });
}
