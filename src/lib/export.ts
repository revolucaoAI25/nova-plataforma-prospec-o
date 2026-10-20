import ExcelJS from "exceljs";
import type { LeadRow, EnrichmentLeadRow, BigDataCorpEnrichmentLeadRow, BigDataCorpSocioRow } from "@/lib/database.types";
import { formatarExibicao, normalizarE164 } from "@/lib/phone";
import { carimboBrasil } from "@/lib/datas";
import { rotuloFonte } from "@/lib/fonte";

// Exportação Excel/CSV — portado de modules/export.py.
export const COLUNAS_PADRAO: Array<[keyof LeadRow, string]> = [
  ["nome", "Nome"],
  ["telefone", "Telefone"],
  ["telefone2", "Telefone 2"],
  ["telefone_internacional", "Telefone Intl."],
  ["email", "E-mail"],
  ["endereco", "Endereço"],
  ["municipio", "Município"],
  ["uf", "UF"],
  ["cep", "CEP"],
  ["site", "Site"],
  ["maps_url", "Google Maps"],
  ["avaliacao", "Avaliação"],
  ["total_avaliacoes", "Nº Avaliações"],
  ["status_funcionamento", "Status"],
  ["cnpj", "CNPJ"],
  ["cnae_codigo", "CNAE"],
  ["natureza_juridica", "Natureza Jurídica"],
  ["matriz_filial", "Matriz/Filial"],
  ["porte", "Porte"],
  ["data_abertura", "Data Abertura"],
  ["capital_social", "Capital Social"],
  ["simples_optante", "Simples Nacional"],
  ["mei_optante", "MEI"],
  ["situacao_especial", "Situação Especial"],
  ["socio_principal", "Sócio Principal"],
  ["cargo", "Cargo"],
  ["empresa_atual", "Empresa Atual"],
  ["senioridade", "Senioridade"],
  ["linkedin_url", "LinkedIn"],
  ["nicho", "Nicho"],
  ["subnicho", "Subnicho"],
  ["cidade_busca", "Cidade Buscada"],
  ["estado_busca", "Estado Buscado"],
  ["fonte", "Fonte"],
  // No fim: o destino Planilha do fluxo acrescenta linhas em planilhas que
  // já existem, e coluna nova no meio desalinharia as antigas.
  ["celular_socio", "Celular do Sócio"],
];

/**
 * Célula de CSV segura: dados vêm de fontes externas (Maps, Instagram…) e
 * um texto como "=HYPERLINK(…)" vira fórmula ao abrir no Excel. Prefixa
 * com apóstrofo o que começa como fórmula, sem mexer em telefones e
 * números (+55 11 9…, -10).
 */
function celulaCsv(valor: string): string {
  const pareceFormula = /^[=@\t\r]/.test(valor) || (/^[+-]/.test(valor) && !/^[+-][\d\s().-]*$/.test(valor));
  const v = (pareceFormula ? `'${valor}` : valor).replace(/"/g, '""');
  return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
}

/** Só vira link clicável na planilha o que for http(s). */
function linkSeguro(valor: string): string | null {
  return /^https?:\/\//i.test(valor) ? valor : null;
}

function cell(lead: LeadRow, col: keyof LeadRow): string {
  const v = lead[col];
  if (col === "fonte") return rotuloFonte(v);
  return v === null || v === undefined ? "" : String(v);
}

export function exportarCsv(leads: LeadRow[]): string {
  const linhas = [COLUNAS_PADRAO.map(([, label]) => label).join(",")];
  for (const lead of leads) {
    const linha = COLUNAS_PADRAO.map(([col]) => celulaCsv(cell(lead, col)));
    linhas.push(linha.join(","));
  }
  // BOM UTF-8 — evita acentos quebrados ao abrir no Excel
  return "﻿" + linhas.join("\r\n");
}

export async function exportarExcel(leads: LeadRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Prospecção");

  ws.columns = COLUNAS_PADRAO.map(([col, label]) => ({ header: label, key: col as string, width: 22 }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  leads.forEach((lead, idx) => {
    const row = ws.addRow(Object.fromEntries(COLUNAS_PADRAO.map(([col]) => [col, cell(lead, col)])));
    if (idx % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
      });
    }
    for (const col of ["site", "maps_url"] as const) {
      const value = linkSeguro(cell(lead, col));
      if (value) {
        const c = row.getCell(col);
        c.value = { text: value, hyperlink: value };
        c.font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ── Exportação de Enriquecimento de Leads via IA — portado de app.py
// (_ENRIQ_COLS/_enriq_csv/_enriq_xlsx). Colunas fixas + uma coluna extra
// por campo customizado que apareceu em algum resultado (nomes livres,
// definidos por quem rodou a busca — não dá pra saber de antemão).
const ENRIQ_COLS: Array<[string, string]> = [
  ["nome_lead", "Nome"], ["email", "E-mail"], ["telefone", "Telefone"],
  ["status", "Status"], ["empresa_nome", "Empresa"], ["cargo", "Cargo"],
  ["cnpj", "CNPJ"], ["municipio", "Município"], ["uf", "UF"],
  ["website", "Site"], ["linkedin_url", "LinkedIn"],
  ["socios", "Sócios"], ["fundacao", "Fundação"],
  ["processos_jusbrasil", "Processo (JusBrasil)"],
  ["resumo", "Resumo"], ["erro", "Erro"],
];

function enriqColunas(leads: EnrichmentLeadRow[]): Array<[string, string]> {
  const vistos = new Set<string>();
  const extras: Array<[string, string]> = [];
  for (const lead of leads) {
    for (const k of Object.keys(lead.extras || {})) {
      if (!vistos.has(k)) {
        vistos.add(k);
        extras.push([`extras.${k}`, k]);
      }
    }
  }
  return [...ENRIQ_COLS, ...extras];
}

function enriqValor(lead: EnrichmentLeadRow, col: string): string {
  if (col.startsWith("extras.")) {
    const v = (lead.extras || {})[col.slice("extras.".length)];
    return v == null ? "" : String(v);
  }
  const v = (lead as unknown as Record<string, unknown>)[col];
  return v == null ? "" : String(v);
}

export function exportarEnrichmentCsv(leads: EnrichmentLeadRow[]): string {
  const cols = enriqColunas(leads);
  const linhas = [cols.map(([, label]) => label).join(",")];
  for (const lead of leads) {
    const linha = cols.map(([col]) => celulaCsv(enriqValor(lead, col)));
    linhas.push(linha.join(","));
  }
  return "﻿" + linhas.join("\r\n");
}

export async function exportarEnrichmentExcel(leads: EnrichmentLeadRow[]): Promise<Buffer> {
  const cols = enriqColunas(leads);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Enriquecimento");

  ws.columns = cols.map(([col, label]) => ({ header: label, key: col, width: 22 }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  leads.forEach((lead, idx) => {
    const row = ws.addRow(Object.fromEntries(cols.map(([col]) => [col, enriqValor(lead, col)])));
    if (idx % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
      });
    }
    for (const col of ["website", "linkedin_url"]) {
      const value = linkSeguro(enriqValor(lead, col));
      if (value) {
        const c = row.getCell(col);
        c.value = { text: value, hyperlink: value };
        c.font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function nomeArquivo(prefixo: string, localidade: string, extensao: string): string {
  const agora = carimboBrasil();
  const slug = localidade.toLowerCase().replace(/\s+/g, "_").replace(/\//g, "-");
  return `${prefixo}_${slug}_${agora}.${extensao}`;
}

// ── Tabelas genéricas (colunas + linhas) ─────────────────────────────
// Base comum do download (CSV/Excel) e do envio ao Google Sheets dos
// enriquecimentos: a mesma tabela sai nos três formatos.

export interface TabelaExport {
  colunas: Array<{ chave: string; label: string }>;
  linhas: Array<Record<string, string>>;
}

export function csvDeTabela(t: TabelaExport): string {
  const linhas = [t.colunas.map((c) => celulaCsv(c.label)).join(",")];
  for (const l of t.linhas) linhas.push(t.colunas.map((c) => celulaCsv(l[c.chave] ?? "")).join(","));
  return "﻿" + linhas.join("\r\n");
}

export async function excelDeTabela(t: TabelaExport, aba: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(aba);
  ws.columns = t.colunas.map((c) => ({ header: c.label, key: c.chave, width: 24 }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  t.linhas.forEach((l, idx) => {
    const row = ws.addRow(l);
    if (idx % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
      });
    }
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Enriquecimento por IA como tabela (mesmas colunas do download). */
export function tabelaEnriquecimento(leads: EnrichmentLeadRow[]): TabelaExport {
  const cols = enriqColunas(leads);
  return {
    colunas: cols.map(([chave, label]) => ({ chave, label })),
    linhas: leads.map((lead) => Object.fromEntries(cols.map(([col]) => [col, enriqValor(lead, col)]))),
  };
}

const formatarFone = (n: string | null | undefined) => (n ? formatarExibicao(normalizarE164(n)) || n : "");

const SITUACAO_SOCIOS: Record<string, string> = {
  concluido: "Empresa encontrada",
  nao_encontrado: "CNPJ sem cadastro",
  erro: "Erro na consulta",
  pendente: "Ainda não processado",
};

/**
 * "Sócios e Contato" (celular do sócio) como planilha de contatos: uma
 * linha por sócio com celular — pronta para importar numa campanha de
 * disparo — e uma linha por empresa sem celular, com o motivo. Os outros
 * sócios da empresa vão numa coluna, para quem quiser ligar.
 */
export function tabelaSociosContato(leads: BigDataCorpEnrichmentLeadRow[]): TabelaExport {
  const colunas = [
    { chave: "empresa", label: "Empresa" },
    { chave: "cnpj", label: "CNPJ" },
    { chave: "socio", label: "Sócio" },
    { chave: "cargo", label: "Cargo" },
    { chave: "celular", label: "Celular do sócio" },
    { chave: "whatsapp", label: "WhatsApp" },
    { chave: "outros_celulares", label: "Outros celulares do sócio" },
    { chave: "telefone_empresa", label: "Telefone da empresa" },
    { chave: "email", label: "E-mail" },
    { chave: "endereco", label: "Endereço" },
    { chave: "outros_socios", label: "Outros sócios" },
    { chave: "situacao", label: "Situação" },
    { chave: "observacao", label: "Observação" },
  ];
  const linhas: Array<Record<string, string>> = [];
  for (const l of leads) {
    const socios = Array.isArray(l.socios) ? (l.socios as unknown as BigDataCorpSocioRow[]) : [];
    const base = {
      empresa: l.razao_social || l.nome_lead || "",
      cnpj: l.cnpj_entrada,
      telefone_empresa: formatarFone(l.telefone),
      email: l.email || "",
      endereco: l.endereco || "",
      observacao: l.erro || "",
    };
    // Sócios com celular; execuções antigas só têm o principal em socio_*.
    const comCelular = socios.filter((s) => s.celular);
    if (!comCelular.length && l.socio_celular) {
      comCelular.push({ nome: l.socio_nome || "", documento: "", qualificacao: l.socio_cargo || "", celular: l.socio_celular, whatsapp: Boolean(l.socio_whatsapp) });
    }
    const resumoOutros = (exceto: string) =>
      socios.filter((s) => s.nome !== exceto).map((s) => `${s.nome}${s.qualificacao ? ` (${s.qualificacao})` : ""}`).join("; ");
    if (comCelular.length) {
      for (const s of comCelular) {
        linhas.push({
          ...base,
          socio: s.nome,
          cargo: s.qualificacao || "",
          celular: formatarFone(s.celular),
          whatsapp: s.whatsapp ? "Sim" : "Não",
          outros_celulares: (s.outros ?? []).map(formatarFone).join("; "),
          outros_socios: resumoOutros(s.nome),
          situacao: "Celular encontrado",
        });
      }
      continue;
    }
    linhas.push({
      ...base,
      socio: l.socio_nome || "",
      cargo: l.socio_cargo || "",
      celular: "",
      whatsapp: "",
      outros_celulares: "",
      outros_socios: resumoOutros(l.socio_nome || ""),
      situacao: l.status === "concluido" ? "Sem celular do sócio" : SITUACAO_SOCIOS[l.status] ?? l.status,
    });
  }
  return { colunas, linhas };
}
