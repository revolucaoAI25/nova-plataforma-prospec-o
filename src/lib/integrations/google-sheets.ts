import { google } from "googleapis";
import { rotuloFonte } from "@/lib/fonte";
import type { LeadRow } from "@/lib/database.types";
import type { GoogleSheetsCreds } from "@/lib/database.types";
import { configPlataforma } from "@/lib/platform-settings";

// Integração com Google Sheets via OAuth2 — o usuário autentica com a
// própria conta Google e escolhe a planilha de uma lista, sem precisar de
// Service Account. Portado de modules/google_sheets.py.
//
// Diferente do produto atual (que aceitava client_id/secret por usuário
// via Streamlit Secrets), aqui usamos UM client OAuth único da plataforma
// — cadastrado em /admin (platform_settings: google_client_id,
// google_client_secret) ou, na ausência, GOOGLE_CLIENT_ID/
// GOOGLE_CLIENT_SECRET do ambiente — mais simples de operar e é o padrão
// de fato para esse tipo de fluxo "Conectar sua conta Google".

// Só os arquivos que a pessoa escolhe no seletor do Google (Picker) ou que a
// plataforma cria. É um escopo não sensível: o app publicado não mostra o
// aviso de "app não verificado" nem tem o limite de 100 contas. Quem
// conectou antes (spreadsheets + drive.readonly) continua com o token antigo,
// que enxerga tudo, até reconectar.
export const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

/** Token conectado antes da troca para o seletor: lista e lê todas as planilhas do Drive. */
export function tokenComAcessoAmplo(creds: OAuthCreds): boolean {
  return (creds.scopes ?? []).some((s) => s.endsWith("/auth/drive.readonly") || s.endsWith("/auth/drive") || s.endsWith("/auth/spreadsheets"));
}

export const MSG_SEM_ACESSO_PLANILHA =
  "A plataforma não tem acesso a essa planilha. Escolha a planilha pelo botão “Escolher do Google Drive” para liberar o acesso.";

/** 404/403 do Google numa planilha: com o escopo drive.file, é planilha que não foi escolhida no seletor (ou foi apagada). */
export function semAcessoPlanilha(e: unknown): boolean {
  const status = (e as { code?: number; status?: number; response?: { status?: number } })?.response?.status
    ?? (e as { code?: number }).code ?? (e as { status?: number }).status;
  // 403 também é "API desativada no projeto" ou cota: só conta como falta de acesso quando fala de permissão.
  return status === 404 || (status === 403 && /permission/i.test((e as Error)?.message ?? ""));
}

function mensagemErroPlanilha(e: unknown): string {
  if (semAcessoPlanilha(e)) return MSG_SEM_ACESSO_PLANILHA;
  // Acesso revogado na conta Google (ou expirado enquanto o app do Google estava "em teste").
  if (/invalid_grant/i.test((e as Error)?.message ?? "")) return "A conexão com o Google expirou. Conecte a sua conta Google de novo em Conexões.";
  return (e as Error).message;
}

export type OAuthCreds = NonNullable<GoogleSheetsCreds["oauth"]>;

async function credenciaisOAuth(): Promise<{ clientId: string; clientSecret: string }> {
  const [clientId, clientSecret] = await Promise.all([
    configPlataforma("google_client_id", process.env.GOOGLE_CLIENT_ID),
    configPlataforma("google_client_secret", process.env.GOOGLE_CLIENT_SECRET),
  ]);
  return { clientId, clientSecret };
}

export async function oauthDisponivel(): Promise<boolean> {
  const { clientId, clientSecret } = await credenciaisOAuth();
  return Boolean(clientId && clientSecret);
}

async function criarClient(redirectUri: string) {
  const { clientId, clientSecret } = await credenciaisOAuth();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function gerarUrlAuth(redirectUri: string, state: string): Promise<string> {
  const client = await criarClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: SCOPES,
    state,
  });
}

export async function trocarCodigo(redirectUri: string, code: string): Promise<OAuthCreds> {
  const client = await criarClient(redirectUri);
  const { tokens } = await client.getToken(code);
  // Só os tokens do usuário vão para o perfil: o client_id/client_secret são
  // da plataforma e ficam nas chaves do admin (o perfil é legível pelo
  // próprio usuário no navegador).
  return {
    token: tokens.access_token || "",
    refresh_token: tokens.refresh_token || undefined,
    token_uri: "https://oauth2.googleapis.com/token",
    scopes: (tokens.scope || SCOPES.join(" ")).split(" "),
  };
}

async function credsClient(creds: OAuthCreds) {
  const { clientId, clientSecret } = await credenciaisOAuth();
  const client = new google.auth.OAuth2(clientId, clientSecret);
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

/** Token de acesso atual (renovado) para o seletor do Google abrir no navegador da própria pessoa. */
export async function tokenParaSeletor(creds: OAuthCreds): Promise<string> {
  const client = await credsClient(creds);
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Não foi possível renovar o acesso ao Google. Conecte a conta de novo em Conexões.");
  return token;
}

/** Cria uma planilha no Drive da pessoa (já fica acessível para a plataforma), com uma aba "Leads". */
export async function criarPlanilha(creds: OAuthCreds, titulo: string): Promise<{ id: string; name: string; abas: string[] }> {
  const auth = await credsClient(creds);
  const sheets = google.sheets({ version: "v4", auth });
  const resp = await sheets.spreadsheets.create({
    requestBody: { properties: { title: titulo, locale: "pt_BR" }, sheets: [{ properties: { title: "Leads" } }] },
    fields: "spreadsheetId,properties.title,sheets.properties.title",
  });
  return {
    id: resp.data.spreadsheetId || "",
    name: resp.data.properties?.title || titulo,
    abas: (resp.data.sheets || []).map((s) => s.properties?.title || "").filter(Boolean),
  };
}

/** Lista as planilhas que a plataforma enxerga: com o escopo novo, as escolhidas no seletor ou criadas por ela. */
export async function listarPlanilhas(creds: OAuthCreds): Promise<Array<{ id: string; name: string }>> {
  const auth = await credsClient(creds);
  const drive = google.drive({ version: "v3", auth });
  const resp = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    pageSize: 100,
    fields: "files(id, name)",
    orderBy: "modifiedTime desc",
  });
  return (resp.data.files || []).map((f) => ({ id: f.id || "", name: f.name || "" }));
}

export async function listarAbas(creds: OAuthCreds, sheetId: string): Promise<string[]> {
  const auth = await credsClient(creds);
  const sheets = google.sheets({ version: "v4", auth });
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: "sheets.properties.title" });
    return (meta.data.sheets || []).map((s) => s.properties?.title || "").filter(Boolean);
  } catch (e) {
    throw new Error(mensagemErroPlanilha(e), { cause: e });
  }
}

export async function lerValores(creds: OAuthCreds, sheetId: string, abaNome: string): Promise<string[][]> {
  const auth = await credsClient(creds);
  const sheets = google.sheets({ version: "v4", auth });
  const escapedAba = abaNome.replace(/'/g, "''");
  try {
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${escapedAba}'` });
    return (resp.data.values as string[][]) || [];
  } catch (e) {
    throw new Error(mensagemErroPlanilha(e), { cause: e });
  }
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
  // Campos de Instagram e LinkedIn no fim, para não desalinhar planilhas que
  // já recebem exportações no modo "acrescentar".
  ["username", "Usuário Instagram"], ["linkedin_url", "LinkedIn"], ["cargo", "Cargo"], ["empresa_atual", "Empresa (LinkedIn)"],
  ["celular_socio", "Celular do Sócio"],
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

/**
 * A gravação usa USER_ENTERED (números e datas viram valores de verdade),
 * então um texto vindo de fonte externa como "=IMPORTXML(…)" seria
 * executado na planilha do cliente. O apóstrofo na frente faz o Sheets
 * tratar como texto, sem mostrar o apóstrofo; telefones e números ficam
 * como estão.
 */
function neutralizarFormula(valor: string): string {
  const pareceFormula = /^[=@]/.test(valor) || (/^[+-]/.test(valor) && !/^[+-][\d\s().,-]*$/.test(valor));
  return pareceFormula ? `'${valor}` : valor;
}

async function escreverPlanilha(
  creds: OAuthCreds,
  sheetId: string,
  abaNome: string,
  modo: "substituir" | "acrescentar",
  cabecalho: string[],
  linhas: string[][],
): Promise<{ ok: boolean; msg: string }> {
  if (!linhas.length) return { ok: false, msg: "Nenhum resultado para exportar." };
  linhas = linhas.map((linha) => linha.map(neutralizarFormula));

  const auth = await credsClient(creds);
  const sheets = google.sheets({ version: "v4", auth });

  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  } catch (e) {
    return { ok: false, msg: mensagemErroPlanilha(e) };
  }
  const sheetTitle = meta.data.properties?.title || sheetId;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  const tabs = (meta.data.sheets || []).map((s) => s.properties?.title || "");

  if (!tabs.includes(abaNome)) {
    return {
      ok: false,
      msg: `Aba '${abaNome}' não encontrada em ${sheetTitle}. Abas disponíveis: ${tabs.join(", ") || "(nenhuma)"}.`,
    };
  }

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
    return { ok: false, msg: `Erro ao escrever: ${mensagemErroPlanilha(e)} | Planilha: ${sheetTitle} | Aba: ${abaNome}` };
  }
}

export async function exportar(
  resultados: LeadRow[],
  creds: OAuthCreds,
  sheetId: string,
  abaNome = "Planilha1",
  modo: "substituir" | "acrescentar" = "substituir",
): Promise<{ ok: boolean; msg: string }> {
  const cabecalho = COLUNAS_EXPORT.map(([, label]) => label);
  const linhas = resultados.map((r) => COLUNAS_EXPORT.map(([col]) => (col === "fonte" ? rotuloFonte(r[col]) : String(r[col] ?? ""))));
  return escreverPlanilha(creds, sheetId, abaNome, modo, cabecalho, linhas);
}

/**
 * Export de colunas dinâmicas — usado pelo nó `destino_sheets` do
 * construtor de fluxos, cujo lote pode carregar campos além do `LeadRow`
 * fixo (ex.: colunas de enriquecimento, ou colunas originais de uma
 * planilha-gatilho). `colunas` define ordem e rótulo; valores ausentes
 * viram string vazia, igual ao `exportar()` acima.
 */
export async function exportarGenerico(
  linhasObjeto: Array<Record<string, unknown>>,
  colunas: Array<{ chave: string; label: string }>,
  creds: OAuthCreds,
  sheetId: string,
  abaNome = "Planilha1",
  modo: "substituir" | "acrescentar" = "substituir",
): Promise<{ ok: boolean; msg: string }> {
  const cabecalho = colunas.map((c) => c.label);
  const linhas = linhasObjeto.map((r) => colunas.map((c) => (c.chave === "fonte" ? rotuloFonte(r[c.chave]) : String(r[c.chave] ?? ""))));
  return escreverPlanilha(creds, sheetId, abaNome, modo, cabecalho, linhas);
}

export function extrairSheetId(urlOuId: string): string | null {
  if (urlOuId.includes("spreadsheets/d/")) {
    const parts = urlOuId.split("spreadsheets/d/")[1]?.split("/");
    return parts?.[0] || null;
  }
  if (urlOuId.length > 20 && !urlOuId.includes("/")) return urlOuId;
  return null;
}
