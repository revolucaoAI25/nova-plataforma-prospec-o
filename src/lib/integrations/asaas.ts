// Wrapper fino para a API REST do Asaas (https://asaas.com) — gateway de
// pagamento pra compra de créditos avulsos. Escolhido pelo próprio
// usuário (conta já existente lá, PIX/boleto/cartão nativos, taxas boas
// pro público brasileiro).
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
  if (!resp.ok) throw new Error(`Asaas ${path} HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
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
 * Cria uma cobrança "à vista" (vence amanhã, sem parcelamento) com
 * `billingType: UNDEFINED` — o pagador escolhe PIX, boleto ou cartão na
 * própria fatura hospedada do Asaas (`invoiceUrl`), sem a gente precisar
 * implementar um checkout customizado. `externalReference` carrega o id
 * da nossa `credit_purchases`, pra casar o webhook de volta com a compra.
 */
export async function criarCobranca(dados: {
  customerId: string;
  valorCentavos: number;
  descricao: string;
  externalReference: string;
}): Promise<AsaasCobranca> {
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 1);
  return req<AsaasCobranca>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.customerId,
      billingType: "UNDEFINED",
      value: Math.round(dados.valorCentavos) / 100,
      dueDate: vencimento.toISOString().slice(0, 10),
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
 * Cria a assinatura recorrente — mesma escolha de `billingType: UNDEFINED`
 * das cobranças avulsas, o pagador decide o método na fatura de cada
 * ciclo. `externalReference` carrega o id do usuário (não temos uma linha
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
}): Promise<AsaasSubscription> {
  const primeiraCobranca = new Date();
  primeiraCobranca.setDate(primeiraCobranca.getDate() + 1);
  return req<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.customerId,
      billingType: "UNDEFINED",
      value: Math.round(dados.valorCentavos) / 100,
      nextDueDate: primeiraCobranca.toISOString().slice(0, 10),
      cycle: dados.cycle ?? "MONTHLY",
      description: dados.descricao,
      externalReference: dados.externalReference,
    }),
  });
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
    throw new Error(`Asaas /subscriptions/${subscriptionId} HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
}

/** A criação da assinatura não retorna a fatura da 1ª cobrança — precisa buscar separado pra redirecionar o cliente já no ato de assinar. */
export async function obterPrimeiraFaturaAssinatura(subscriptionId: string): Promise<AsaasCobranca | null> {
  const lista = await req<{ data: AsaasCobranca[] }>(`/subscriptions/${subscriptionId}/payments`);
  return lista.data?.[0] ?? null;
}
