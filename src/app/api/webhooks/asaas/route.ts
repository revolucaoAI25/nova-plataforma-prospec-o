import { NextResponse } from "next/server";
import { marcarCompraPaga } from "@/lib/credit-purchases-db";
import { processarPagamentoAssinatura, marcarAssinaturaInadimplente } from "@/lib/subscriptions-db";
import { processarPagamentoAddon, marcarAddonInadimplente } from "@/lib/addons-db";
import { configPlataforma } from "@/lib/platform-settings";

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

export async function POST(request: Request) {
  const tokenEsperado = await configPlataforma("asaas_webhook_token", process.env.ASAAS_WEBHOOK_TOKEN);
  if (tokenEsperado) {
    const tokenRecebido = request.headers.get("asaas-access-token");
    if (tokenRecebido !== tokenEsperado) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body?.event) return NextResponse.json({ ok: true });

  const payment = body.payment;
  const assinaturaId: string | undefined = payment?.subscription;

  if (EVENTOS_PAGO.has(body.event) && payment?.id) {
    if (assinaturaId) {
      const valorCentavos = Math.round((payment.value ?? 0) * 100);
      const foiPlano = await processarPagamentoAssinatura(assinaturaId, payment.id, valorCentavos);
      if (!foiPlano) await processarPagamentoAddon(assinaturaId, payment.id, valorCentavos);
    } else {
      await marcarCompraPaga(payment.id);
    }
  } else if (body.event === "PAYMENT_OVERDUE" && assinaturaId) {
    const foiPlano = await marcarAssinaturaInadimplente(assinaturaId);
    if (!foiPlano) await marcarAddonInadimplente(assinaturaId);
  }

  return NextResponse.json({ ok: true });
}
