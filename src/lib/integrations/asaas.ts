// Wrapper fino para a API REST do Asaas (https://asaas.com) — gateway de
// pagamento das assinaturas, add-ons e compras de créditos avulsos.
// Assinaturas (planos e add-ons) só no cartão de crédito (FORMA_PAGAMENTO);
// compras avulsas de créditos aceitam Pix, boleto ou cartão (FORMA_AVULSA).
//
// Auth: header `access_token: <chave>` (chave única da plataforma,
// cadastrada em /admin — platform_settings: asaas_api_key — ou, na
// ausência, ASAAS_API_KEY do ambiente; ver src/lib/platform-settings.ts).
// A base URL é resolvida pelo PREFIXO da própria chave — chaves de
// sandbox começam com `$aact_hmlg_`, produção com `$aact_prod_` —
// evitando uma variável extra só pra isso.
//
// Ressalva: nenhum endpoint abaixo teve schema de resposta 100%
// confirmado contra o servidor real (baseado na documentação oficial,
// docs.asaas.com) — mesma ressalva que resend.ts/evolution-api.ts já
// carregam.
import { configPlataforma } from "@/lib/platform-settings";
import { dataISOBrasil } from "@/lib/datas";

/**
 * Forma de pagamento das assinaturas: cartão de crédito. O cartão informado
 * na primeira fatura fica salvo e as renovações são cobradas nele sozinhas.
 */
const FORMA_PAGAMENTO = "CREDIT_CARD";

/**
 * Compra avulsa de créditos: o cliente escolhe na fatura do Asaas entre Pix,
 * boleto e cartão ("UNDEFINED" = perguntar ao cliente). Os créditos entram
 * quando o pagamento é confirmado (Pix na hora; boleto em até 3 dias úteis).
 */
const FORMA_AVULSA = "UNDEFINED";

async function chaveApi(): Promise<string> {
  return configPlataforma("asaas_api_key", process.env.ASAAS_API_KEY);
}

async function baseUrl(): Promise<string> {
  const chave = await chaveApi();
  return chave.startsWith("$aact_prod_") ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

export async function asaasConfigurado(): Promise<boolean> {
  return Boolean(await chaveApi());
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const [url, chave] = await Promise.all([baseUrl(), chaveApi()]);
  const resp = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: chave,
      "User-Agent": "RevolucaoAI-ProspeccaoAtiva",
      ...init?.headers,
    },
  });
  if (!resp.ok) throw new Error(`Serviço de pagamento (${path}) respondeu ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

interface AsaasCustomer {
  id: string;
}

/** Cria um cliente Asaas pra vincular às cobranças futuras do usuário — chamado só na 1ª compra (o id fica salvo em `profiles.asaas_customer_id`). */
export async function criarClienteAsaas(dados: {
  nome: string;
  cpfCnpj: string;
  email: string;
  externalReference: string;
  /** E.164 sem "+"; o Asaas quer só DDD + número. */
  telefone?: string | null;
}): Promise<string> {
  const tel = (dados.telefone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const cliente = await req<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: dados.nome,
      cpfCnpj: dados.cpfCnpj.replace(/\D/g, ""),
      email: dados.email,
      ...(tel ? { mobilePhone: tel } : {}),
      externalReference: dados.externalReference,
    }),
  });
  return cliente.id;
}

export interface AsaasCobranca {
  id: string;
  status: string;
  invoiceUrl: string;
}

/**
 * Cria uma cobrança "à vista" (vence em 3 dias, prazo que cabe um boleto,
 * sem parcelamento), paga por Pix, boleto ou cartão na própria fatura
 * hospedada do Asaas (`invoiceUrl`),
 * sem a gente precisar implementar um checkout customizado. `externalReference` carrega o id
 * da nossa `credit_purchases`, pra casar o webhook de volta com a compra.
 */
export async function criarCobranca(dados: {
  customerId: string;
  valorCentavos: number;
  descricao: string;
  externalReference: string;
}): Promise<AsaasCobranca> {
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 3);
  return req<AsaasCobranca>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.customerId,
      billingType: FORMA_AVULSA,
      value: Math.round(dados.valorCentavos) / 100,
      dueDate: dataISOBrasil(vencimento),
      description: dados.descricao,
      externalReference: dados.externalReference,
    }),
  });
}

interface AsaasSubscription {
  id: string;
  status: string;
}

/**
 * Cria a assinatura recorrente no cartão de crédito: o cliente informa o
 * cartão na fatura da 1ª cobrança e as renovações são cobradas nele. `externalReference` carrega o id do usuário (não temos uma linha
 * própria de "assinatura pendente" pra referenciar como em `criarCompra`,
 * já que `profiles` já guarda o estado atual da assinatura diretamente).
 * `cycle` default MONTHLY (mantém o comportamento de antes pra quem já
 * chamava sem o parâmetro — add-ons, por exemplo, são sempre mensais);
 * YEARLY é usado pelo plano anual (uma cobrança só por ano, ver
 * `assinarPlano` em subscriptions-db.ts).
 */
export async function criarAssinatura(dados: {
  customerId: string;
  valorCentavos: number;
  descricao: string;
  externalReference: string;
  cycle?: "MONTHLY" | "YEARLY";
  /** Para onde a fatura leva a pessoa sozinha depois do pagamento aprovado. */
  retornoUrl?: string;
}): Promise<AsaasSubscription> {
  const primeiraCobranca = new Date();
  primeiraCobranca.setDate(primeiraCobranca.getDate() + 1);
  const corpo = {
    customer: dados.customerId,
    billingType: FORMA_PAGAMENTO,
    value: Math.round(dados.valorCentavos) / 100,
    nextDueDate: dataISOBrasil(primeiraCobranca),
    cycle: dados.cycle ?? "MONTHLY",
    description: dados.descricao,
    externalReference: dados.externalReference,
  };
  if (dados.retornoUrl) {
    try {
      return await req<AsaasSubscription>("/subscriptions", {
        method: "POST",
        body: JSON.stringify({ ...corpo, callback: { successUrl: dados.retornoUrl, autoRedirect: true } }),
      });
    } catch (err) {
      // O Asaas só aceita retorno para o domínio cadastrado nos dados
      // comerciais da conta. Recusado o retorno (resposta 400), a assinatura
      // sai sem ele (a pessoa volta pelo botão da fatura ou entrando na
      // plataforma). Falha de rede não repete: a primeira pode ter sido criada.
      if (!/respondeu 400/.test(err instanceof Error ? err.message : "")) throw err;
      console.warn("[asaas] assinatura com retorno automático recusada; criando sem retorno", err);
    }
  }
  return req<AsaasSubscription>("/subscriptions", { method: "POST", body: JSON.stringify(corpo) });
}

/**
 * Encerra definitivamente a recorrência (o Asaas remove cobranças
 * pendentes/vencidas, mantém as já pagas). 404 é tratado como sucesso —
 * a assinatura já não existe mais no Asaas (ex: removida manualmente no
 * dashboard) — pra não deixar o usuário travado sem conseguir cancelar
 * localmente só porque o lado de lá já não tem o que cancelar.
 */
export async function cancelarAssinatura(subscriptionId: string): Promise<void> {
  const [url, chave] = await Promise.all([baseUrl(), chaveApi()]);
  const resp = await fetch(`${url}/subscriptions/${subscriptionId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", access_token: chave, "User-Agent": "RevolucaoAI-ProspeccaoAtiva" },
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Serviço de pagamento (assinatura) respondeu ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
}

/** A criação da assinatura não retorna a fatura da 1ª cobrança — precisa buscar separado pra redirecionar o cliente já no ato de assinar. */
/** Cobrança como o Asaas a vê agora: usada pelo webhook para não confiar só no corpo recebido. */
export interface AsaasCobrancaDetalhe {
  id: string;
  status: string;
  value: number;
  subscription?: string | null;
  externalReference?: string | null;
}

export async function obterCobranca(paymentId: string): Promise<AsaasCobrancaDetalhe> {
  return req<AsaasCobrancaDetalhe>(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function obterPrimeiraFaturaAssinatura(subscriptionId: string): Promise<AsaasCobranca | null> {
  const lista = await req<{ data: AsaasCobranca[] }>(`/subscriptions/${subscriptionId}/payments`);
  return lista.data?.[0] ?? null;
}

/** Fatura em aberto de uma assinatura (vencida antes, depois a próxima a vencer): o link para o cliente pagar. */
export async function obterFaturaEmAberto(subscriptionId: string): Promise<AsaasCobranca | null> {
  for (const status of ["OVERDUE", "PENDING"]) {
    const lista = await req<{ data: AsaasCobranca[] }>(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?status=${status}`);
    if (lista.data?.[0]) return lista.data[0];
  }
  return null;
}

export interface AsaasAssinaturaDetalhe {
  id: string;
  status: string;
  deleted?: boolean;
}

/** Assinatura como o Asaas a vê agora (status ACTIVE, INACTIVE ou EXPIRED; `deleted` quando removida). */
export async function obterAssinatura(subscriptionId: string): Promise<AsaasAssinaturaDetalhe> {
  return req<AsaasAssinaturaDetalhe>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}
