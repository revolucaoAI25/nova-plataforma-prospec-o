import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { marcarCompraPaga } from "@/lib/credit-purchases-db";
import { processarPagamentoAssinatura, marcarAssinaturaInadimplente } from "@/lib/subscriptions-db";
import { processarPagamentoAddon, marcarAddonInadimplente } from "@/lib/addons-db";
import { configPlataforma } from "@/lib/platform-settings";
import { obterCobranca } from "@/lib/integrations/asaas";

// Rota PÚBLICA (sem auth de usuário) — recebida pelo Asaas quando o
// status de uma cobrança muda. Configurada manualmente no dashboard do
// Asaas (Configurações → Integrações → Webhooks) apontando pra esta URL,
// com o "Token de autenticação" preenchido igual a ASAAS_WEBHOOK_TOKEN —
// o Asaas ecoa esse token de volta no header `asaas-access-token` de toda
// entrega, que é como validamos que a requisição é legítima (mecanismo
// documentado pelo próprio Asaas, diferente da Unipile, que não publica
// um jeito de assinar o payload).
//
// Eventos assinados: PAYMENT_CONFIRMED (cartão pré-autorizado) e
// PAYMENT_RECEIVED (dinheiro de fato recebido — único evento que dispara
// pra PIX/boleto), e PAYMENT_OVERDUE (cobrança de assinatura vencida sem
// pagamento). O campo `payment.subscription` é o que diferencia uma
// renovação de assinatura de uma compra avulsa de créditos — só cobranças
// geradas por uma assinatura carregam esse campo.

const EVENTOS_PAGO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

// Status do Asaas que significam dinheiro recebido.
const STATUS_PAGO = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

function tokenConfere(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // Sem token configurado, recusa tudo: esta rota libera créditos e planos,
  // e o id da cobrança aparece no link da fatura que o próprio cliente recebe.
  const tokenEsperado = await configPlataforma("asaas_webhook_token", process.env.ASAAS_WEBHOOK_TOKEN);
  if (!tokenEsperado || !tokenConfere(request.headers.get("asaas-access-token"), tokenEsperado)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.event) return NextResponse.json({ ok: true });

  const paymentId: string | undefined = body.payment?.id;
  const ehPago = EVENTOS_PAGO.has(body.event);
  const ehVencido = body.event === "PAYMENT_OVERDUE";
  if (!paymentId || (!ehPago && !ehVencido)) return NextResponse.json({ ok: true });

  // Segunda camada: o que vale é a cobrança consultada na API do Asaas, não
  // o corpo do evento (valor, assinatura e status vêm de lá).
  let payment;
  try {
    payment = await obterCobranca(paymentId);
  } catch (err) {
    console.error("[webhooks/asaas] não foi possível consultar a cobrança", paymentId, err);
    return NextResponse.json({ error: "Falha ao consultar a cobrança." }, { status: 500 });
  }
  if (ehPago && !STATUS_PAGO.has(payment.status)) return NextResponse.json({ ok: true });
  if (ehVencido && payment.status !== "OVERDUE") return NextResponse.json({ ok: true });
  const assinaturaId = payment.subscription || undefined;

  // Um erro de verdade (não os "não encontrado"/"evento repetido" que já
  // voltam como false/true das próprias funções) precisa virar 500 aqui —
  // responder 200 OK quando algo realmente falhou faz o Asaas achar que
  // processamos com sucesso e nunca reentregar o evento, perdendo crédito
  // ou mudança de status silenciosamente. As funções chamadas abaixo já
  // são idempotentes, então uma reentrega depois de um 500 é segura.
  try {
    if (ehPago) {
      if (assinaturaId) {
        const valorCentavos = Math.round((payment.value ?? 0) * 100);
        const foiPlano = await processarPagamentoAssinatura(assinaturaId, payment.id, valorCentavos);
        if (!foiPlano) await processarPagamentoAddon(assinaturaId, payment.id, valorCentavos);
      } else {
        await marcarCompraPaga(payment.id, {
          valorCentavos: Math.round((payment.value ?? 0) * 100),
          referenciaExterna: payment.externalReference ?? null,
        });
      }
    } else if (ehVencido && assinaturaId) {
      const foiPlano = await marcarAssinaturaInadimplente(assinaturaId);
      if (!foiPlano) await marcarAddonInadimplente(assinaturaId);
    }
  } catch (err) {
    console.error("[webhooks/asaas] falha ao processar evento", body.event, paymentId, err);
    return NextResponse.json({ error: "Falha ao processar o evento." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
