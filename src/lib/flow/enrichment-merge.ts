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
  socio_nome: "Sócio — Nome",
  socio_cargo: "Sócio — Cargo",
  socio_celular: "Sócio — Celular",
  socio_whatsapp: "Sócio — Tem WhatsApp",
  telefone_empresa: "Telefone da empresa",
  bigdatacorp_status: "Sócios e Contato — Status",
  bigdatacorp_razao_social: "Sócios e Contato — Razão social",
  bigdatacorp_socios: "Sócios e Contato — Sócios",
  bigdatacorp_socio_nome: "Sócios e Contato — Nome do sócio principal",
  bigdatacorp_telefone: "Sócios e Contato — Telefone",
  bigdatacorp_email: "Sócios e Contato — E-mail",
  bigdatacorp_endereco: "Sócios e Contato — Endereço",
};

/**
 * Mescla os resultados de uma execução de enriquecimento por CNPJ
 * (`bigdatacorp_enrichment_leads`) de volta no lote, casando por CNPJ.
 *
 * Telefone: quando achou o celular do sócio, ele vira o `telefone` do lead
 * (é para ele que o disparo de WhatsApp deve ir) e o da empresa fica em
 * `telefone_empresa`. Sem celular do sócio, vale o telefone que o lead já
 * tinha e, na falta, o da empresa trazido pela consulta.
 *
 * `umLeadPorSocio`: no modo "vários sócios", cada sócio com celular vira um
 * lead (mesma empresa, contato diferente). Empresa sem nenhum celular
 * continua como um lead só.
 */
export function mesclarBigDataCorpNoLote(
  lote: Array<Record<string, unknown>>,
  bigdatacorpLeads: BigDataCorpEnrichmentLeadRow[],
  opcoes: { umLeadPorSocio?: boolean } = {},
): Array<Record<string, unknown>> {
  const porCnpj = new Map<string, BigDataCorpEnrichmentLeadRow>();
  for (const bl of bigdatacorpLeads) {
    const doc = apenasDigitos(bl.cnpj_entrada);
    if (doc) porCnpj.set(doc, bl);
  }

  return lote.flatMap((lead) => {
    const doc = apenasDigitos(String(lead.cnpj || ""));
    const resultado = doc ? porCnpj.get(doc) : undefined;
    if (!resultado) return [lead];

    const socios = Array.isArray(resultado.socios) ? (resultado.socios as BigDataCorpSocioRow[]) : [];
    const sociosTexto = socios.map((s) => s.nome + (s.qualificacao ? ` (${s.qualificacao})` : "")).join("; ");
    const telefoneOriginal = String(lead.telefone || "") || resultado.telefone || "";

    const base: Record<string, unknown> = {
      ...lead,
      email: resultado.email || lead.email || "",
      bigdatacorp_status: resultado.status,
      bigdatacorp_razao_social: resultado.razao_social || "",
      bigdatacorp_socios: sociosTexto,
      bigdatacorp_telefone: resultado.telefone || "",
      bigdatacorp_email: resultado.email || "",
      bigdatacorp_endereco: resultado.endereco || "",
    };
    const comSocio = (nome: string, cargo: string, celular: string, whatsapp: boolean) => ({
      ...base,
      telefone: celular || telefoneOriginal,
      telefone_empresa: telefoneOriginal,
      socio_nome: nome,
      socio_cargo: cargo,
      socio_celular: celular,
      socio_whatsapp: celular ? (whatsapp ? "sim" : "não") : "",
      // Nome antigo do campo: mensagens e fluxos já salvos usam este.
      bigdatacorp_socio_nome: nome,
      socio_principal: nome || lead.socio_principal || "",
    });

    if (opcoes.umLeadPorSocio) {
      const comCelular = socios.filter((s) => s.celular);
      if (comCelular.length) return comCelular.map((s) => comSocio(s.nome, s.qualificacao, s.celular || "", Boolean(s.whatsapp)));
    }
    return [comSocio(resultado.socio_nome || socios[0]?.nome || "", resultado.socio_cargo || "", resultado.socio_celular || "", Boolean(resultado.socio_whatsapp))];
  });
}
