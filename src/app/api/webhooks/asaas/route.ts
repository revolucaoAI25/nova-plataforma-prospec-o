import { NextResponse } from "next/server";
import { marcarCompraPaga } from "@/lib/credit-purchases-db";

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
// pra PIX/boleto). Credita em qualquer um dos dois que chegar primeiro;
// `marcarCompraPaga` é idempotente (entrega do Asaas é "at least once").

const EVENTOS_CREDITAM = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

export async function POST(request: Request) {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (tokenEsperado) {
    const tokenRecebido = request.headers.get("asaas-access-token");
    if (tokenRecebido !== tokenEsperado) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body?.event) return NextResponse.json({ ok: true });

  if (EVENTOS_CREDITAM.has(body.event)) {
    const paymentId = body.payment?.id;
    if (paymentId) await marcarCompraPaga(paymentId);
  }

  return NextResponse.json({ ok: true });
}
