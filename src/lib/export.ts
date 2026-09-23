import ExcelJS from "exceljs";
import type { LeadRow, EnrichmentLeadRow } from "@/lib/database.types";

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
];

function cell(lead: LeadRow, col: keyof LeadRow): string {
  const v = lead[col];
  return v === null || v === undefined ? "" : String(v);
}

export function exportarCsv(leads: LeadRow[]): string {
  const linhas = [COLUNAS_PADRAO.map(([, label]) => label).join(",")];
  for (const lead of leads) {
    const linha = COLUNAS_PADRAO.map(([col]) => {
      const v = cell(lead, col).replace(/"/g, '""');
      return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
    });
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
      const value = cell(lead, col);
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
    const linha = cols.map(([col]) => {
      const v = enriqValor(lead, col).replace(/"/g, '""');
      return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
    });
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
      const value = enriqValor(lead, col);
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
  const agora = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const slug = localidade.toLowerCase().replace(/\s+/g, "_").replace(/\//g, "-");
  return `${prefixo}_${slug}_${agora}.${extensao}`;
}
