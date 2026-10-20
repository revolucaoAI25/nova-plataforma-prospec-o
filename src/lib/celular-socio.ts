import type { SupabaseClient } from "@supabase/supabase-js";
import type { BigDataCorpSocioRow, OpcoesCelularSocio } from "@/lib/database.types";
import {
  consultarEmpresaBruto, consultarPessoaBruto, ErroDirectData, lerEmpresa, lerPessoa,
  type SocioEmpresa, type TelefonePessoa,
} from "@/lib/integrations/direct-data";

/**
 * Celular do sócio: CNPJ → sócios (com CPF) → celular de cada sócio
 * escolhido. Usado pelo worker do enriquecimento "Sócios e Contato", que
 * atende a aba Enriquecimento, a opção da busca por CNPJ e o nó do fluxo.
 *
 * Cada consulta paga fica no cache `consultas_cadastrais` por 90 dias: o
 * mesmo CNPJ ou CPF não é pago de novo pela plataforma nesse período
 * (quem pede continua sendo cobrado em créditos, com ou sem cache). Só é
 * cobrada consulta que trouxe cadastro: CNPJ/CPF sem cadastro no
 * fornecedor, ou sócio sem CPF na empresa (nem é consultado), não debitam.
 */

export const OPCOES_CELULAR_SOCIO_PADRAO: OpcoesCelularSocio = {
  socios: "administrador",
  maxSocios: 2,
  soWhatsapp: true,
  respeitarBloqueio: true,
};

export const MAX_SOCIOS_POR_EMPRESA = 5;

export function normalizarOpcoesCelularSocio(v: unknown): OpcoesCelularSocio {
  const o = v && typeof v === "object" ? (v as Partial<OpcoesCelularSocio>) : {};
  const max = Math.round(Number(o.maxSocios));
  return {
    socios: o.socios === "todos" ? "todos" : "administrador",
    maxSocios: Number.isFinite(max) ? Math.min(Math.max(max, 1), MAX_SOCIOS_POR_EMPRESA) : OPCOES_CELULAR_SOCIO_PADRAO.maxSocios,
    soWhatsapp: o.soWhatsapp !== false,
    respeitarBloqueio: o.respeitarBloqueio !== false,
  };
}

/** Quantos sócios no máximo são consultados por empresa com essas opções (para estimar o custo). */
export function sociosPorEmpresa(o: OpcoesCelularSocio): number {
  return o.socios === "todos" ? o.maxSocios : 1;
}

// ── Cache ────────────────────────────────────────────────────────────

const VALIDADE_CACHE_MS = 90 * 86_400_000;

async function comCache(
  sb: SupabaseClient, tipo: "pj" | "pf", documento: string, consultar: () => Promise<Record<string, unknown> | null>,
): Promise<Record<string, unknown> | null> {
  const { data } = await sb.from("consultas_cadastrais").select("resposta, consultado_em").eq("tipo", tipo).eq("documento", documento).maybeSingle();
  if (data && Date.now() - new Date(data.consultado_em).getTime() < VALIDADE_CACHE_MS) {
    return (data.resposta as Record<string, unknown> | null) ?? null;
  }
  const retorno = await consultar();
  await sb.from("consultas_cadastrais").upsert({ tipo, documento, resposta: retorno, consultado_em: new Date().toISOString() });
  return retorno;
}

// ── Escolhas ─────────────────────────────────────────────────────────

const CARGO_DECISOR = /administrador|diretor|presidente|titular|gerente/i;

/**
 * Sócios a consultar, administradores primeiro. Sócio sem CPF (outra
 * empresa, ou documento mascarado) não tem como ser consultado e fica de
 * fora. No modo "administrador", sem administrador cai no primeiro sócio
 * pessoa física.
 */
export function escolherSocios(socios: SocioEmpresa[], o: OpcoesCelularSocio): SocioEmpresa[] {
  const pessoas = socios.filter((s) => s.cpf);
  const decisores = pessoas.filter((s) => CARGO_DECISOR.test(s.cargo));
  const ordenados = [...decisores, ...pessoas.filter((s) => !decisores.includes(s))];
  return ordenados.slice(0, sociosPorEmpresa(o));
}

const ehCelular = (t: TelefonePessoa) => t.movel || /^\d{2}9\d{8}$/.test(t.numero);

/** Celulares aceitos, na ordem de preferência (com WhatsApp primeiro, depois a ordem da fonte). */
export function escolherCelulares(telefones: TelefonePessoa[], o: OpcoesCelularSocio): TelefonePessoa[] {
  const vistos = new Set<string>();
  const aceitos = telefones.filter((t) => {
    if (!ehCelular(t) || vistos.has(t.numero)) return false;
    if (o.respeitarBloqueio && t.bloqueado) return false;
    if (o.soWhatsapp && !t.whatsapp) return false;
    vistos.add(t.numero);
    return true;
  });
  return [...aceitos.filter((t) => t.whatsapp), ...aceitos.filter((t) => !t.whatsapp)];
}

/** CPF mascarado para exibir e guardar fora do cache: ***.456.789-** */
export function mascararDocumento(doc: string): string {
  return doc.length === 11 ? `***.${doc.slice(3, 6)}.${doc.slice(6, 9)}-**` : doc;
}

// ── Consulta de uma empresa ──────────────────────────────────────────

export interface ResultadoSociosEmpresa {
  encontrado: boolean;
  razaoSocial: string;
  telefone: string;
  email: string;
  endereco: string;
  socios: BigDataCorpSocioRow[];
  socioNome: string;
  socioCargo: string;
  socioCelular: string;
  socioWhatsapp: boolean;
  consultasPessoa: number;
  /** Algum sócio deixou de ser consultado (falta de créditos ou erro). */
  aviso: string | null;
}

/**
 * Consulta a empresa e o celular dos sócios escolhidos. `podeConsultarPessoa`
 * é perguntado antes de cada CPF (saldo de créditos) e `aoConsultarPessoa`
 * é chamado depois de cada um (cobrança). Erro fatal da fonte (token,
 * saldo da plataforma) sobe como `ErroDirectData` com `fatal`.
 */
export async function consultarSociosDaEmpresa(
  sb: SupabaseClient,
  cnpj: string,
  opcoes: OpcoesCelularSocio,
  podeConsultarPessoa: () => boolean,
  aoConsultarPessoa: () => Promise<void>,
  /** Devolve a reserva de `podeConsultarPessoa` quando a consulta não rendeu (erro ou CPF sem cadastro). */
  devolverReserva: () => void = () => {},
): Promise<ResultadoSociosEmpresa> {
  const vazio: ResultadoSociosEmpresa = {
    encontrado: false, razaoSocial: "", telefone: "", email: "", endereco: "", socios: [],
    socioNome: "", socioCargo: "", socioCelular: "", socioWhatsapp: false, consultasPessoa: 0, aviso: null,
  };
  const bruto = await comCache(sb, "pj", cnpj, () => consultarEmpresaBruto(cnpj));
  if (!bruto) return vazio;
  const empresa = lerEmpresa(bruto);

  const escolhidos = escolherSocios(empresa.socios, opcoes);
  const celularPorCpf = new Map<string, TelefonePessoa[]>();
  let consultasPessoa = 0;
  let aviso: string | null = null;
  // Só sócio com CPF completo entra em `escolhidos` (escolherSocios): sem
  // CPF na resposta da empresa, a 2ª consulta nem acontece. E só é cobrado
  // o sócio cuja consulta trouxe cadastro — erro ou CPF sem cadastro no
  // fornecedor devolvem a reserva e não debitam nada.
  for (const socio of escolhidos) {
    if (!podeConsultarPessoa()) {
      aviso = "Créditos insuficientes para consultar o celular do sócio.";
      break;
    }
    let pessoa: Record<string, unknown> | null;
    try {
      pessoa = await comCache(sb, "pf", socio.cpf, () => consultarPessoaBruto(socio.cpf));
    } catch (e) {
      devolverReserva();
      if (e instanceof ErroDirectData && e.fatal) throw e;
      aviso = `Não deu para consultar ${socio.nome}: ${(e as Error).message}`;
      continue;
    }
    if (!pessoa) {
      devolverReserva();
      celularPorCpf.set(socio.cpf, []);
      continue;
    }
    celularPorCpf.set(socio.cpf, escolherCelulares(lerPessoa(pessoa).telefones, opcoes));
    consultasPessoa += 1;
    await aoConsultarPessoa();
  }

  const socios: BigDataCorpSocioRow[] = empresa.socios.map((s) => {
    const celulares = s.cpf ? celularPorCpf.get(s.cpf) : undefined;
    return {
      nome: s.nome,
      documento: mascararDocumento(s.cpf),
      qualificacao: s.cargo,
      ...(celulares ? { celular: celulares[0]?.numero ?? null, whatsapp: Boolean(celulares[0]?.whatsapp), outros: celulares.slice(1, 4).map((c) => c.numero) } : {}),
    };
  });

  // Sócio principal: o primeiro escolhido que tem celular; sem nenhum, o
  // primeiro escolhido (o nome ainda serve para a mensagem).
  const principal = escolhidos.find((s) => celularPorCpf.get(s.cpf)?.length) ?? escolhidos[0] ?? empresa.socios[0];
  const celular = principal?.cpf ? celularPorCpf.get(principal.cpf)?.[0] : undefined;

  return {
    encontrado: true,
    razaoSocial: empresa.razaoSocial,
    telefone: empresa.telefones[0] ?? "",
    email: empresa.email,
    endereco: empresa.endereco,
    socios,
    socioNome: principal?.nome ?? "",
    socioCargo: principal?.cargo ?? "",
    socioCelular: celular?.numero ?? "",
    socioWhatsapp: Boolean(celular?.whatsapp),
    consultasPessoa,
    aviso,
  };
}
