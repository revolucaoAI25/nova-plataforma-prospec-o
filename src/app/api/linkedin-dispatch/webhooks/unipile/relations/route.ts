import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterContaPorUnipileId, obterTargetAguardandoAceitePorProviderId, liberarAlvoAposAceite } from "@/lib/linkedin-dispatch-db";

// Rota PÚBLICA (sem auth de usuário) — recebida pela Unipile no evento
// `new_relation` (fonte USERS), mecanismo principal pra detectar que um
// pedido de conexão foi aceito. Não é em tempo real (a doc da Unipile
// avisa: atraso de até ~8h é esperado do lado do LinkedIn) — por isso
// existe também o poll de reforço em worker/linkedin-dispatch-tick.ts
// (tickLinkedInRelationsPoll).
//
// Ressalva: schema exato do payload não publicado nas páginas de doc
// consultadas — tenta os campos mais prováveis de forma defensiva.

export async function POST(request: Request) {
  const sb = createAdminClient();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const unipileAccountId = String(body.account_id || body.accountId || "");
  const providerId = String(body.provider_id || body.user?.provider_id || body.relation?.provider_id || body.user_provider_id || "");

  if (!unipileAccountId || !providerId) {
    console.warn(`[webhook linkedin/relations] payload sem account_id/provider_id reconhecível: ${JSON.stringify(body).slice(0, 500)}`);
    return NextResponse.json({ ok: true });
  }

  const conta = await obterContaPorUnipileId(sb, unipileAccountId);
  if (!conta) return NextResponse.json({ ok: true });

  const target = await obterTargetAguardandoAceitePorProviderId(sb, conta.id, providerId);
  if (target) await liberarAlvoAposAceite(sb, target);

  return NextResponse.json({ ok: true });
}
