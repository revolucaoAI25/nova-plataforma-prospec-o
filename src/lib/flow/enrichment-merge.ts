import type { EnrichmentLeadRow, BigDataCorpEnrichmentLeadRow, BigDataCorpSocioRow } from "@/lib/database.types";
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

export const BIGDATACORP_LABELS: Record<string, string> = {
  bigdatacorp_status: "BigDataCorp — Status",
  bigdatacorp_razao_social: "BigDataCorp — Razão social",
  bigdatacorp_socios: "BigDataCorp — Sócios",
  bigdatacorp_telefone: "BigDataCorp — Telefone",
  bigdatacorp_email: "BigDataCorp — E-mail",
  bigdatacorp_endereco: "BigDataCorp — Endereço",
};

/**
 * Mescla os resultados de uma execução de enriquecimento por CNPJ
 * (`bigdatacorp_enrichment_leads`) de volta no lote — casando por CNPJ
 * (chave exata, ao contrário do enriquecimento via IA que precisa de
 * heurística por e-mail/telefone/nome: aqui o CNPJ já é o identificador
 * único usado na consulta). Também retroalimenta `telefone`/`email` do
 * próprio lead quando estavam vazios — é isso que deixa o contato do
 * sócio pronto pro disparo (WhatsApp/e-mail) sem exigir que quem monta o
 * fluxo saiba que existe um campo `bigdatacorp_telefone` separado.
 */
export function mesclarBigDataCorpNoLote(
  lote: Array<Record<string, unknown>>,
  bigdatacorpLeads: BigDataCorpEnrichmentLeadRow[],
): Array<Record<string, unknown>> {
  const porCnpj = new Map<string, BigDataCorpEnrichmentLeadRow>();
  for (const bl of bigdatacorpLeads) {
    const doc = apenasDigitos(bl.cnpj_entrada);
    if (doc) porCnpj.set(doc, bl);
  }

  return lote.map((lead) => {
    const doc = apenasDigitos(String(lead.cnpj || ""));
    const resultado = doc ? porCnpj.get(doc) : undefined;
    if (!resultado) return lead;

    const socios = Array.isArray(resultado.socios) ? (resultado.socios as BigDataCorpSocioRow[]) : [];
    const sociosTexto = socios.map((s) => s.nome + (s.qualificacao ? ` (${s.qualificacao})` : "")).join("; ");

    return {
      ...lead,
      telefone: lead.telefone || resultado.telefone || "",
      email: lead.email || resultado.email || "",
      bigdatacorp_status: resultado.status,
      bigdatacorp_razao_social: resultado.razao_social || "",
      bigdatacorp_socios: sociosTexto,
      bigdatacorp_telefone: resultado.telefone || "",
      bigdatacorp_email: resultado.email || "",
      bigdatacorp_endereco: resultado.endereco || "",
    };
  });
}
