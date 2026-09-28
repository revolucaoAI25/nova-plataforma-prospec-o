import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterConta, obterContaPorUnipileId, atualizarConta } from "@/lib/linkedin-dispatch-db";
import { webhookSegredoValido } from "@/lib/integrations/unipile";
import type { LinkedinAccountStatus } from "@/lib/database.types";

// Rota PÚBLICA (sem auth de usuário) — recebida pela Unipile quando o
// status de uma conta conectada muda (conexão concluída, credencial
// expirada/precisa reconectar, etc.). Configurada via
// criarWebhook(url, "account_status") em src/lib/integrations/unipile.ts
// (chamada uma vez, não a cada request). URL cadastrada na Unipile deve
// incluir `?secret=<UNIPILE_WEBHOOK_SECRET>` — ver webhookSegredoValido().
//
// Ressalva: a doc pública da Unipile não publica o schema exato desse
// payload (só descreve o conceito — comparar o novo status com o
// guardado). Este handler tenta os nomes de campo mais prováveis
// (`account_id`, `status`, `name`) de forma defensiva; se a Unipile
// mandar algo diferente, o primeiro evento real vai logar o payload bruto
// pra ajustar a extração.

const STATUS_MAP: Record<string, LinkedinAccountStatus> = {
  OK: "conectado",
  CREDENTIALS: "requer_reconexao",
};

export async function POST(request: Request) {
  if (!webhookSegredoValido(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sb = createAdminClient();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const unipileAccountId = String(body.account_id || body.accountId || "");
  const statusBruto = String(body.status || body.AccountStatus?.status || "");
  const nomeRef = String(body.name || "");
  const perfilNome = body.user?.name || body.account?.name || null;

  let conta = unipileAccountId ? await obterContaPorUnipileId(sb, unipileAccountId) : null;
  if (!conta && nomeRef) conta = await obterConta(sb, nomeRef);
  if (!conta) {
    console.warn(`[webhook linkedin/account-status] conta não encontrada — payload: ${JSON.stringify(body).slice(0, 500)}`);
    return NextResponse.json({ ok: true });
  }

  const novoStatus = STATUS_MAP[statusBruto] || "desconectado";
  await atualizarConta(sb, conta.id, {
    status: novoStatus,
    unipile_account_id: unipileAccountId || conta.unipile_account_id,
    perfil_nome: perfilNome || conta.perfil_nome,
  });

  return NextResponse.json({ ok: true });
}
