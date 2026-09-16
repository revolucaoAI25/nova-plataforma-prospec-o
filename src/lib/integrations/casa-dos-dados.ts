import { apenasDigitos } from "@/lib/phone";
import { emptyLead, type CnaeTipo, type Lead } from "@/lib/types";

// Integração com a API da Casa dos Dados (casadosdados.com.br) — dados
// oficiais de CNPJ/Receita Federal. Portado de modules/casa_dos_dados.py
// do produto atual. Ver seção 5.4 do plano de reconstrução para as
// pegadinhas descobertas em produção (datas invertidas, CNAE
// secundário incerto, limite de 1000/página, etc.)

const ENDPOINT = "https://api.casadosdados.com.br/v5/cnpj/pesquisa";
const MAX_POR_PAGINA = 1000;

export interface BuscaTextual {
  texto: string[];
  tipo_busca: "exata";
  razao_social: boolean;
  nome_fantasia: boolean;
}

export interface CasaDosDadosParams {
  apiKey: string;
  cnaes: string[];
  uf: string | string[];
  municipio?: string | string[];
  porte?: string[] | null;
  matrizFilial?: "" | "MATRIZ" | "FILIAL";
  simplesOptante?: boolean | null;
  excluirSimples?: boolean;
  meiOptante?: boolean | null;
  excluirMei?: boolean;
  comTelefone?: boolean;
  comEmail?: boolean;
  somenteCelular?: boolean;
  somenteFixo?: boolean;
  excluirEmailContab?: boolean;
  dataAberturaInicio?: string;
  dataAberturaFim?: string;
  capitalMin?: number | null;
  capitalMax?: number | null;
  limite: number;
  excludePhones?: Set<string>;
  excludeCnpjs?: Set<string>;
  cnaeTipo?: CnaeTipo;
  buscaTextual?: BuscaTextual[] | null;
  situacoesCadastrais?: string[] | null;
  dedupRaiz?: boolean;
  onProgress?: (atual: number, total: number, msg: string) => void;
}

function toList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];
}

function normalizarMunicipio(m: string): string {
  return m
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function montarBody(params: CasaDosDadosParams, pagina: number, limitePagina: number) {
  const body: Record<string, unknown> = {
    situacao_cadastral: params.situacoesCadastrais ?? ["ATIVA"],
    limite: limitePagina,
    pagina,
  };

  if (params.buscaTextual) body.busca_textual = params.buscaTextual;

  const cnaes = params.cnaes;
  if (cnaes?.length) {
    const limpos = cnaes.map((c) => c.replace(/[-/.]/g, ""));
    const tipo = params.cnaeTipo ?? "principal";
    if (tipo === "principal" || tipo === "ambos") body.codigo_atividade_principal = limpos;
    if (tipo === "secundario" || tipo === "ambos") body.codigo_atividade_secundaria = limpos;
  }

  const ufs = toList(params.uf);
  if (ufs.length) body.uf = ufs.map((u) => u.toLowerCase());

  const municipios = toList(params.municipio);
  if (municipios.length) body.municipio = municipios.map(normalizarMunicipio);

  if (params.porte?.length) body.porte_empresa = { codigos: params.porte };

  if (params.matrizFilial === "MATRIZ" || params.matrizFilial === "FILIAL") {
    body.matriz_filial = params.matrizFilial;
  }

  const simplesObj: Record<string, boolean> = {};
  if (params.simplesOptante === true) simplesObj.optante = true;
  if (params.excluirSimples) simplesObj.excluir_optante = true;
  if (Object.keys(simplesObj).length) body.simples = simplesObj;

  const meiObj: Record<string, boolean> = {};
  if (params.meiOptante === true) meiObj.optante = true;
  if (params.excluirMei) meiObj.excluir_optante = true;
  if (Object.keys(meiObj).length) body.mei = meiObj;

  const mais: Record<string, boolean> = {};
  if (params.comTelefone) mais.com_telefone = true;
  if (params.comEmail) mais.com_email = true;
  if (params.somenteCelular) mais.somente_celular = true;
  else if (params.somenteFixo) mais.somente_fixo = true;
  if (params.excluirEmailContab) mais.excluir_email_contab = true;
  if (Object.keys(mais).length) body.mais_filtros = mais;

  const dataObj: Record<string, string> = {};
  if (params.dataAberturaInicio) dataObj.inicio = params.dataAberturaInicio;
  if (params.dataAberturaFim) dataObj.fim = params.dataAberturaFim;
  if (Object.keys(dataObj).length) body.data_abertura = dataObj;

  const capitalObj: Record<string, number> = {};
  if (params.capitalMin != null) capitalObj.minimo = params.capitalMin;
  if (params.capitalMax != null) capitalObj.maximo = params.capitalMax;
  if (Object.keys(capitalObj).length) body.capital_social = capitalObj;

  return body;
}

function fmtTelefoneCdd(t: Record<string, unknown> | undefined): string {
  if (!t) return "";
  const ddd = String(t.ddd ?? "").trim();
  const num = String(t.numero ?? "").trim();
  if (ddd && num) return `(${ddd}) ${num}`;
  return String(t.completo ?? "").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearLead(item: any): Lead {
  const lead = emptyLead();
  lead.nome = (item.razao_social || item.nome_fantasia || "").trim();

  const end = item.endereco || {};
  const partesEnd = [end.tipo_logradouro, end.logradouro, end.numero, end.complemento, end.bairro]
    .filter(Boolean)
    .join(" ");
  lead.endereco = partesEnd.replace(/^,\s*|,\s*$/g, "").trim();

  const tels: Array<Record<string, unknown>> = item.contato_telefonico || [];
  lead.telefone = tels[0] ? fmtTelefoneCdd(tels[0]) : "";
  lead.telefone2 = tels[1] ? fmtTelefoneCdd(tels[1]) : "";
  lead.tipo_telefone = tels[0] ? String(tels[0].tipo ?? "") : "";

  const emails: Array<Record<string, unknown>> = item.contato_email || [];
  lead.email = emails[0] ? String(emails[0].email ?? "") : "";

  let ativ = item.atividade_principal || {};
  if (Array.isArray(ativ)) ativ = ativ[0] || {};
  lead.nicho_busca = ativ.descricao || "";
  lead.cnae_codigo = ativ.codigo || "";

  const porteObj = item.porte_empresa || {};
  lead.subnicho_busca = porteObj.descricao || "";
  lead.porte = porteObj.descricao || "";

  const dataAberturaRaw = item.data_abertura || "";
  lead.data_abertura = dataAberturaRaw ? String(dataAberturaRaw).slice(0, 10) : "";

  const qsa: Array<Record<string, unknown>> = item.quadro_societario || [];
  lead.socio_principal = qsa[0] ? String(qsa[0].nome ?? "") : "";

  const simplesObj = item.simples || {};
  const meiObj = item.mei || {};
  lead.simples_optante = simplesObj.optante ? "Sim" : "Não";
  lead.mei_optante = meiObj.optante ? "Sim" : "Não";

  const sitEsp = item.situacao_especial;
  lead.situacao_especial =
    sitEsp && typeof sitEsp === "object" ? sitEsp.descricao || "" : sitEsp ? String(sitEsp) : "";

  lead.cnpj = item.cnpj || "";
  lead.municipio = end.municipio || "";
  lead.uf = (end.uf || "").toUpperCase();
  lead.cep = end.cep || "";
  lead.matriz_filial = item.matriz_filial || "";
  lead.natureza_juridica = item.descricao_natureza_juridica || "";
  lead.capital_social = String(item.capital_social ?? "");
  lead.cidade_busca = end.municipio || "";
  lead.estado_busca = (end.uf || "").toUpperCase();
  lead.fonte = "Casa dos Dados";

  return lead;
}

/** Remove duplicados por CNPJ ou telefone (histórico + lote atual). Muta os sets recebidos. */
export function removerDuplicadosLote(
  leads: Lead[],
  cnpjsVistos: Set<string>,
  telsVistos: Set<string>,
): Lead[] {
  const unicos: Lead[] = [];
  for (const lead of leads) {
    const cnpj = lead.cnpj;
    const tel1 = apenasDigitos(lead.telefone);
    const tel2 = apenasDigitos(lead.telefone2);

    if (cnpj && cnpjsVistos.has(cnpj)) continue;
    if ((tel1 && telsVistos.has(tel1)) || (tel2 && telsVistos.has(tel2))) continue;

    if (cnpj) cnpjsVistos.add(cnpj);
    if (tel1) telsVistos.add(tel1);
    if (tel2) telsVistos.add(tel2);
    unicos.push(lead);
  }
  return unicos;
}

export class CasaDosDadosError extends Error {}

export async function buscarCnpj(params: CasaDosDadosParams): Promise<Lead[]> {
  const resultados: Lead[] = [];
  let pagina = 1;
  let totalApi: number | null = null;
  const { limite } = params;

  while (resultados.length < limite) {
    let porPagina = Math.min(MAX_POR_PAGINA, limite - resultados.length + 50);
    porPagina = Math.min(porPagina, MAX_POR_PAGINA);

    const body = montarBody(params, pagina, porPagina);

    let resp: Response;
    try {
      resp = await fetch(`${ENDPOINT}?tipo_resultado=completo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": params.apiKey },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new CasaDosDadosError(`Erro de conexão com Casa dos Dados: ${(e as Error).message}`);
    }

    if (!resp.ok) {
      let msg = "";
      try {
        const j = await resp.json();
        msg = j.message || "";
      } catch {
        msg = await resp.text().catch(() => "");
      }
      throw new CasaDosDadosError(`Erro HTTP ${resp.status} na API Casa dos Dados: ${msg.slice(0, 200)}`);
    }

    const data = await resp.json();
    const itens: unknown[] = data.cnpjs || [];
    if (totalApi === null) totalApi = data.total || 0;
    if (!itens.length) break;

    for (const item of itens) {
      const lead = mapearLead(item);

      if (params.excludeCnpjs && lead.cnpj && params.excludeCnpjs.has(lead.cnpj)) continue;
      if (params.excludePhones) {
        const d1 = apenasDigitos(lead.telefone);
        const d2 = apenasDigitos(lead.telefone2);
        if ((d1 && params.excludePhones.has(d1)) || (d2 && params.excludePhones.has(d2))) continue;
      }

      resultados.push(lead);
      if (resultados.length >= limite) break;
    }

    params.onProgress?.(resultados.length, limite, `Página ${pagina} — ${resultados.length}/${limite} leads…`);

    const obtidosAteAgora = pagina * porPagina;
    if (itens.length < porPagina || (totalApi && obtidosAteAgora >= totalApi)) break;
    pagina += 1;
  }

  let finalResults = resultados;
  if (params.dedupRaiz) {
    const seenRaiz = new Set<string>();
    finalResults = [];
    for (const r of resultados) {
      const raiz = (r.cnpj || "").slice(0, 8);
      if (raiz && seenRaiz.has(raiz)) continue;
      if (raiz) seenRaiz.add(raiz);
      finalResults.push(r);
    }
  }

  return finalResults.slice(0, limite);
}
