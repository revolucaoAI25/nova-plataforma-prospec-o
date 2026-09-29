// Wrapper fino para a API REST da BigDataCorp (https://bigdatacorp.com.br)
// — enriquecimento de empresa a partir do CNPJ: cadastro, sócios/quadro
// societário e telefone/e-mail registrados. Auth: headers `AccessToken` +
// `TokenId`. Endpoint único `POST /empresas`, combinando datasets numa
// mesma chamada (cada dataset pedido em `Datasets` é cobrado
// separadamente pela BigDataCorp, mas dentro de uma única requisição).
//
// Configuração: cadastrada em /admin (platform_settings:
// bigdatacorp_token_id, bigdatacorp_access_token) ou, na ausência,
// BIGDATACORP_TOKEN_ID/BIGDATACORP_ACCESS_TOKEN do ambiente — ver
// src/lib/platform-settings.ts. Chave ÚNICA da plataforma por enquanto
// (custo absorvido pela plataforma, não por usuário — diferente do
// enriquecimento via IA, que usa a chave OpenAI de cada usuário).
import { configPlataforma } from "@/lib/platform-settings";
//
// Ressalva (mesmo espírito de evolution-api.ts/resend.ts/unipile.ts):
// `basic_data` e `registration_data` (e-mail/telefone/endereço da empresa)
// têm o request/response confirmados contra a documentação pública
// (docs.bigdatacorp.com.br). O dataset de sócios/quadro societário
// (`dynamic_qsa_data`) teve o NOME TÉCNICO inferido de uma referência
// indexada — a página de doc específica não carregou durante a pesquisa,
// então a estrutura exata da resposta não foi confirmada. O parsing abaixo
// tenta os caminhos mais prováveis de forma defensiva e guarda a resposta
// bruta em `extras` (ver bigdatacorp-enrichment-db.ts) — ajustar
// `extrairSocios()` assim que o primeiro resultado real chegar, se o
// formato divergir.

const DATASETS = "basic_data,registration_data,dynamic_qsa_data";

function baseUrl(): string {
  return "https://plataforma.bigdatacorp.com.br";
}

async function headers(): Promise<Record<string, string>> {
  const [accessToken, tokenId] = await Promise.all([
    configPlataforma("bigdatacorp_access_token", process.env.BIGDATACORP_ACCESS_TOKEN),
    configPlataforma("bigdatacorp_token_id", process.env.BIGDATACORP_TOKEN_ID),
  ]);
  return { AccessToken: accessToken, TokenId: tokenId, "Content-Type": "application/json" };
}

export async function bigDataCorpConfigurado(): Promise<boolean> {
  const [accessToken, tokenId] = await Promise.all([
    configPlataforma("bigdatacorp_access_token", process.env.BIGDATACORP_ACCESS_TOKEN),
    configPlataforma("bigdatacorp_token_id", process.env.BIGDATACORP_TOKEN_ID),
  ]);
  return Boolean(accessToken && tokenId);
}

export interface BigDataCorpSocio {
  nome: string;
  documento: string;
  qualificacao: string;
}

export interface BigDataCorpResultadoEmpresa {
  encontrado: boolean;
  razaoSocial: string;
  socios: BigDataCorpSocio[];
  telefone: string;
  email: string;
  endereco: string;
  bruto: unknown;
}

function apenasDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function extrairRazaoSocial(basicData: Record<string, unknown> | undefined): string {
  if (!basicData) return "";
  const chaves = ["OfficialName", "CompanyName", "RazaoSocial", "TradeName", "Name"];
  for (const chave of chaves) {
    const v = basicData[chave];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function extrairContatoRegistro(registrationData: Record<string, unknown> | undefined): { telefone: string; email: string; endereco: string } {
  if (!registrationData) return { telefone: "", email: "", endereco: "" };

  const emails = registrationData.Emails as Record<string, unknown> | undefined;
  const emailPrimario = emails?.Primary as Record<string, unknown> | undefined;
  const email = typeof emailPrimario?.EmailAddress === "string" ? emailPrimario.EmailAddress : "";

  const phones = registrationData.Phones as Record<string, unknown> | undefined;
  const phonePrimario = phones?.Primary as Record<string, unknown> | undefined;
  const ddd = typeof phonePrimario?.AreaCode === "string" ? phonePrimario.AreaCode : "";
  const numero = typeof phonePrimario?.Number === "string" ? phonePrimario.Number : "";
  const telefone = numero ? `${ddd}${apenasDigitos(numero)}` : "";

  const addresses = registrationData.Addresses as Record<string, unknown> | undefined;
  const addrPrimario = addresses?.Primary as Record<string, unknown> | undefined;
  const endereco = typeof addrPrimario?.Address === "string" ? addrPrimario.Address
    : typeof addrPrimario?.Street === "string" ? addrPrimario.Street : "";

  return { telefone, email, endereco };
}

/** Ver ressalva de topo — schema exato não confirmado, tenta os caminhos mais prováveis. */
function extrairSocios(qsaData: unknown): BigDataCorpSocio[] {
  if (!qsaData || typeof qsaData !== "object") return [];
  const obj = qsaData as Record<string, unknown>;
  const listaBruta = (obj.Shareholders || obj.Partners || obj.Members || obj.Qsa) as unknown;
  if (!Array.isArray(listaBruta)) return [];

  return listaBruta
    .map((item): BigDataCorpSocio | null => {
      if (!item || typeof item !== "object") return null;
      const s = item as Record<string, unknown>;
      const nome = String(s.Name || s.OfficialName || s.Nome || "").trim();
      if (!nome) return null;
      const documento = String(s.TaxIdNumber || s.Document || s.Cpf || "").trim();
      const qualificacao = String(s.Qualification || s.Role || s.Qualificacao || "").trim();
      return { nome, documento, qualificacao };
    })
    .filter((s): s is BigDataCorpSocio => s !== null);
}

/** Consulta um CNPJ na BigDataCorp — `POST /empresas`, Limit 1, os 3 datasets combinados numa chamada só. */
export async function consultarEmpresaBigDataCorp(cnpj: string): Promise<BigDataCorpResultadoEmpresa> {
  const doc = apenasDigitos(cnpj);
  const resp = await fetch(`${baseUrl()}/empresas`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ Datasets: DATASETS, q: `doc{${doc}}`, Limit: 1 }),
  });
  if (!resp.ok) throw new Error(`BigDataCorp HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);

  const json = await resp.json();
  const resultado = Array.isArray(json?.Result) ? json.Result[0] : null;
  if (!resultado) return { encontrado: false, razaoSocial: "", socios: [], telefone: "", email: "", endereco: "", bruto: json };

  const razaoSocial = extrairRazaoSocial(resultado.BasicData as Record<string, unknown> | undefined);
  // Estrutura confirmada na doc pública (dataset `registration_data`
  // isolado): Result[i].RegistrationData.{Emails,Phones,Addresses}.
  const contato = extrairContatoRegistro(resultado.RegistrationData as Record<string, unknown> | undefined);
  const socios = extrairSocios(resultado.DynamicQsaData ?? resultado.QsaData);

  return {
    encontrado: Boolean(razaoSocial || socios.length || contato.telefone || contato.email),
    razaoSocial, socios, telefone: contato.telefone, email: contato.email, endereco: contato.endereco,
    bruto: json,
  };
}
