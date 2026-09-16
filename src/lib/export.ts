import ExcelJS from "exceljs";
import type { LeadRow } from "@/lib/database.types";

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

export function nomeArquivo(prefixo: string, localidade: string, extensao: string): string {
  const agora = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const slug = localidade.toLowerCase().replace(/\s+/g, "_").replace(/\//g, "-");
  return `${prefixo}_${slug}_${agora}.${extensao}`;
}
