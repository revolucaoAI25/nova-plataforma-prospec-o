import { google } from "googleapis";
import type { LeadRow } from "@/lib/database.types";
import type { GoogleSheetsCreds } from "@/lib/database.types";

// Integração com Google Sheets via OAuth2 — o usuário autentica com a
// própria conta Google e escolhe a planilha de uma lista, sem precisar de
// Service Account. Portado de modules/google_sheets.py.
//
// Diferente do produto atual (que aceitava client_id/secret por usuário
// via Streamlit Secrets), aqui usamos UM client OAuth único da plataforma
// (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) — mais simples de operar e é o
// padrão de fato para esse tipo de fluxo "Conectar sua conta Google".

export const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
];

export type OAuthCreds = NonNullable<GoogleSheetsCreds["oauth"]>;

export function oauthDisponivel(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function criarClient(redirectUri: string) {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
}

export function gerarUrlAuth(redirectUri: string, state: string): string {
  const client = criarClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: SCOPES,
    state,
  });
}

export async function trocarCodigo(redirectUri: string, code: string): Promise<OAuthCreds> {
  const client = criarClient(redirectUri);
  const { tokens } = await client.getToken(code);
  return {
    token: tokens.access_token || "",
    refresh_token: tokens.refresh_token || undefined,
    token_uri: "https://oauth2.googleapis.com/token",
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    scopes: (tokens.scope || SCOPES.join(" ")).split(" "),
  };
}

async function credsClient(creds: OAuthCreds) {
  const client = new google.auth.OAuth2(creds.client_id, creds.client_secret);
  client.setCredentials({ access_token: creds.token, refresh_token: creds.refresh_token });
  if (creds.refresh_token) {
    try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
    } catch {
      // usa o token existente; a chamada seguinte retenta no 401
    }
  }
  return client;
}

export async function listarPlanilhas(creds: OAuthCreds): Promise<Array<{ id: string; name: string }>> {
  const auth = await credsClient(creds);
  const drive = google.drive({ version: "v3", auth });
  const resp = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    pageSize: 50,
    fields: "files(id, name)",
    orderBy: "modifiedTime desc",
  });
  return (resp.data.files || []).map((f) => ({ id: f.id || "", name: f.name || "" }));
}

export async function listarAbas(creds: OAuthCreds, sheetId: string): Promise<string[]> {
  const auth = await credsClient(creds);
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  return (meta.data.sheets || []).map((s) => s.properties?.title || "").filter(Boolean);
}

export async function lerValores(creds: OAuthCreds, sheetId: string, abaNome: string): Promise<string[][]> {
  const auth = await credsClient(creds);
  const sheets = google.sheets({ version: "v4", auth });
  const escapedAba = abaNome.replace(/'/g, "''");
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${escapedAba}'` });
  return (resp.data.values as string[][]) || [];
}

const COLUNAS_EXPORT: Array<[keyof LeadRow, string]> = [
  ["nome", "Nome"], ["telefone", "Telefone"], ["telefone2", "Telefone 2"], ["email", "E-mail"],
  ["endereco", "Endereço"], ["municipio", "Município"], ["uf", "UF"], ["cep", "CEP"],
  ["site", "Site"], ["maps_url", "Google Maps"], ["avaliacao", "Avaliação"],
  ["total_avaliacoes", "Nº Avaliações"], ["cnpj", "CNPJ"], ["nicho", "Nicho"],
  ["cnae_codigo", "CNAE"], ["subnicho", "Subnicho / Porte"], ["matriz_filial", "Matriz/Filial"],
  ["natureza_juridica", "Natureza Jurídica"], ["data_abertura", "Data Abertura"],
  ["capital_social", "Capital Social (R$)"], ["simples_optante", "Simples Nacional"],
  ["mei_optante", "MEI"], ["situacao_especial", "Situação Especial"],
  ["tipo_telefone", "Tipo Telefone"], ["socio_principal", "Sócio Principal"],
  ["cidade_busca", "Cidade Buscada"], ["estado_busca", "Estado Buscado"],
  ["instagram_id", "Instagram ID"], ["comentario", "Comentário"],
];

async function garantirLinhas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheetsApi: any,
  sheetId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: any,
  abaNome: string,
  linhasNecessarias: number,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const sheet of meta.data.sheets || []) {
    const props = sheet.properties || {};
    if (props.title !== abaNome) continue;
    const linhasAtuais = props.gridProperties?.rowCount || 1000;
    if (linhasNecessarias <= linhasAtuais) return;
    const adicionar = linhasNecessarias - linhasAtuais + 100;
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ appendDimension: { sheetId: props.sheetId, dimension: "ROWS", length: adicionar } }],
      },
    });
    return;
  }
}

export async function exportar(
  resultados: LeadRow[],
  creds: OAuthCreds,
  sheetId: string,
  abaNome = "Planilha1",
  modo: "substituir" | "acrescentar" = "substituir",
): Promise<{ ok: boolean; msg: string }> {
  if (!resultados.length) return { ok: false, msg: "Nenhum resultado para exportar." };

  const auth = await credsClient(creds);
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheetTitle = meta.data.properties?.title || sheetId;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  const tabs = (meta.data.sheets || []).map((s) => s.properties?.title || "");

  if (!tabs.includes(abaNome)) {
    return {
      ok: false,
      msg: `Aba '${abaNome}' não encontrada em ${sheetTitle}. Abas disponíveis: ${tabs.join(", ") || "(nenhuma)"}.`,
    };
  }

  const cabecalho = COLUNAS_EXPORT.map(([, label]) => label);
  const linhas = resultados.map((r) => COLUNAS_EXPORT.map(([col]) => String(r[col] ?? "")));
  const escapedAba = abaNome.replace(/'/g, "''");

  try {
    let updatedCells: number | undefined;
    let updatedRange = "?";

    if (modo === "substituir") {
      await garantirLinhas(sheets, sheetId, meta, abaNome, linhas.length + 1);
      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: `'${escapedAba}'` });
      const upd = await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${escapedAba}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [cabecalho, ...linhas] },
      });
      updatedCells = upd.data.updatedCells ?? undefined;
      updatedRange = upd.data.updatedRange || "?";
    } else {
      const colA = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${escapedAba}'!A:A` });
      const nextRow = (colA.data.values || []).length + 1;

      if (nextRow === 1) {
        await garantirLinhas(sheets, sheetId, meta, abaNome, linhas.length + 1);
        const upd = await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'${escapedAba}'!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [cabecalho, ...linhas] },
        });
        updatedCells = upd.data.updatedCells ?? undefined;
        updatedRange = upd.data.updatedRange || "?";
      } else {
        await garantirLinhas(sheets, sheetId, meta, abaNome, nextRow + linhas.length - 1);
        const upd = await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'${escapedAba}'!A${nextRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: linhas },
        });
        updatedCells = upd.data.updatedCells ?? undefined;
        updatedRange = upd.data.updatedRange || "?";
      }
    }

    if (!updatedCells) {
      return { ok: false, msg: `A API aceitou a requisição mas não escreveu células. Planilha: ${sheetTitle} | Aba: ${abaNome}` };
    }

    return {
      ok: true,
      msg: `${linhas.length} registros exportados para ${sheetTitle} → aba ${abaNome}. Células escritas: ${updatedCells} | Intervalo: ${updatedRange}. ${sheetUrl}`,
    };
  } catch (e) {
    return { ok: false, msg: `Erro ao escrever: ${(e as Error).message} | Planilha: ${sheetTitle} | Aba: ${abaNome}` };
  }
}

export function extrairSheetId(urlOuId: string): string | null {
  if (urlOuId.includes("spreadsheets/d/")) {
    const parts = urlOuId.split("spreadsheets/d/")[1]?.split("/");
    return parts?.[0] || null;
  }
  if (urlOuId.length > 20 && !urlOuId.includes("/")) return urlOuId;
  return null;
}
