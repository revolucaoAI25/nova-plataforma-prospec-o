// Wrapper fino para a API REST do Asaas (https://asaas.com) — gateway de
// pagamento pra compra de créditos avulsos. Escolhido pelo próprio
// usuário (conta já existente lá, PIX/boleto/cartão nativos, taxas boas
// pro público brasileiro).
//
// Auth: header `access_token: <ASAAS_API_KEY>` (chave única da
// plataforma). A base URL é resolvida pelo PREFIXO da própria chave —
// chaves de sandbox começam com `$aact_hmlg_`, produção com
// `$aact_prod_` — evitando uma variável de ambiente extra só pra isso.
//
// Ressalva: nenhum endpoint abaixo teve schema de resposta 100%
// confirmado contra o servidor real (baseado na documentação oficial,
// docs.asaas.com) — mesma ressalva que resend.ts/evolution-api.ts já
// carregam.

function baseUrl(): string {
  const chave = process.env.ASAAS_API_KEY || "";
  return chave.startsWith("$aact_prod_") ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

export function asaasConfigurado(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY || "",
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
}): Promise<string> {
  const cliente = await req<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: dados.nome,
      cpfCnpj: dados.cpfCnpj.replace(/\D/g, ""),
      email: dados.email,
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
