import { configPlataforma } from "@/lib/platform-settings";
import { apenasDigitos } from "@/lib/phone";

/**
 * Direct Data (apiv3.directd.com.br) — de onde vem o celular do sócio.
 *
 * Duas consultas, as mais baratas que resolvem (R$ 0,16 cada):
 * - Cadastro Pessoa Jurídica Básica (`/api/CadastroPessoaJuridica?CNPJ=`):
 *   razão social, endereço, telefones e e-mails da empresa e os sócios com
 *   CPF completo e cargo ("Sócio Administrador", "Sócio"…).
 * - Cadastro Pessoa Física Básica (`/api/CadastroPessoaFisica?CPF=`):
 *   telefones da pessoa, cada um com tipo (móvel/residencial), indicação de
 *   WhatsApp e de bloqueio de telemarketing.
 * As versões "Plus" só acrescentam dados que não usamos (faturamento,
 * parentes, renda).
 *
 * Testado contra a API real (out/2026) com restaurantes de Santo André: o
 * CPF do sócio vem completo e os administradores tinham celular com
 * WhatsApp. Autenticação por `Authorization: Bearer {token}`; a resposta
 * sempre traz `metaDados.resultadoId` (1 sucesso, 6 não encontrado, 3 não
 * autorizado, 29 sem saldo…) junto com o status HTTP.
 */

const BASE = "https://apiv3.directd.com.br/api";
const TIMEOUT_MS = 60_000;

export function tokenDirectData(): Promise<string> {
  return configPlataforma("directd_token", process.env.DIRECTD_TOKEN);
}

export async function directDataConfigurado(): Promise<boolean> {
  return Boolean(await tokenDirectData());
}

/**
 * `fatal`: não adianta seguir consultando (token inválido, conta da
 * plataforma sem saldo ou sem o produto no plano). Os demais erros são de
 * uma consulta só (tempo esgotado, manutenção) e o lote segue.
 */
export class ErroDirectData extends Error {
  constructor(message: string, readonly fatal: boolean) {
    super(message);
  }
}

interface RespostaDirectData {
  metaDados?: { resultadoId?: number; resultado?: string; mensagem?: string };
  retorno?: unknown;
}

/** Faz a consulta. `null` quando o documento não foi encontrado. */
async function consultar(endpoint: string, params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const token = await tokenDirectData();
  if (!token) throw new ErroDirectData("Consulta de sócios não configurada na plataforma.", true);

  let resp: Response;
  try {
    resp = await fetch(`${BASE}/${endpoint}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new ErroDirectData(`Falha de conexão com o serviço de consulta (${(e as Error).message}).`, false);
  }
  const json = (await resp.json().catch(() => ({}))) as RespostaDirectData;
  const id = json.metaDados?.resultadoId;
  const mensagem = json.metaDados?.mensagem || json.metaDados?.resultado || `HTTP ${resp.status}`;

  if (resp.ok && id === 1) return (json.retorno as Record<string, unknown>) ?? null;
  if (resp.status === 404 || id === 6) return null;
  if (resp.status === 401 || resp.status === 403) {
    // 401: token/IP; 403: saldo ou plano da conta da plataforma — vale para
    // todas as consultas seguintes, então para o lote.
    throw new ErroDirectData(`Serviço de consulta recusou o pedido: ${mensagem}`, true);
  }
  throw new ErroDirectData(`Serviço de consulta indisponível: ${mensagem}`, false);
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const lista = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

export interface SocioEmpresa {
  nome: string;
  /** Só dígitos; vazio quando o sócio é empresa ou o documento veio mascarado. */
  cpf: string;
  cargo: string;
}

export interface EmpresaConsultada {
  razaoSocial: string;
  socios: SocioEmpresa[];
  telefones: string[];
  email: string;
  endereco: string;
}

export interface TelefonePessoa {
  numero: string;
  movel: boolean;
  whatsapp: boolean;
  bloqueado: boolean;
}

export interface PessoaConsultada {
  nome: string;
  telefones: TelefonePessoa[];
}

/** Lê o retorno guardado (da API ou do cache) no formato que usamos. */
export function lerEmpresa(retorno: Record<string, unknown>): EmpresaConsultada {
  const end = lista(retorno.enderecos)[0];
  const endereco = end
    ? [texto(end.logradouro), texto(end.numero), texto(end.complemento), texto(end.bairro), texto(end.cidade), texto(end.uf)].filter(Boolean).join(", ")
    : "";
  return {
    razaoSocial: texto(retorno.razaoSocial),
    socios: lista(retorno.socios)
      .map((s) => {
        const doc = apenasDigitos(texto(s.documento));
        return { nome: texto(s.nome), cpf: doc.length === 11 ? doc : "", cargo: texto(s.cargo) };
      })
      .filter((s) => s.nome),
    telefones: lista(retorno.telefones).map((t) => apenasDigitos(texto(t.telefoneComDDD))).filter((t) => t.length >= 10),
    email: texto(lista(retorno.emails)[0]?.enderecoEmail).toLowerCase(),
    endereco,
  };
}

export function lerPessoa(retorno: Record<string, unknown>): PessoaConsultada {
  return {
    nome: texto(retorno.nome),
    telefones: lista(retorno.telefones)
      .map((t) => ({
        numero: apenasDigitos(texto(t.telefoneComDDD)),
        movel: /m[óo]vel|celular/i.test(texto(t.tipoTelefone)),
        whatsapp: t.whatsApp === true,
        bloqueado: t.telemarketingBloqueado === true,
      }))
      .filter((t) => t.numero.length >= 10),
  };
}

/** Retorno bruto da consulta da empresa (para o cache), ou null se não encontrada. */
export function consultarEmpresaBruto(cnpj: string): Promise<Record<string, unknown> | null> {
  return consultar("CadastroPessoaJuridica", { CNPJ: apenasDigitos(cnpj) });
}

/** Retorno bruto da consulta da pessoa (para o cache), ou null se não encontrada. */
export function consultarPessoaBruto(cpf: string): Promise<Record<string, unknown> | null> {
  return consultar("CadastroPessoaFisica", { CPF: apenasDigitos(cpf) });
}
