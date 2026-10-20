import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditPackageRow, PlanRow } from "@/lib/database.types";

/**
 * Condição de preço travada de um usuário (profiles.condicao_preco, ver
 * migration 0044): fotografia da tabela de preços no momento em que o admin
 * ligou "Manter a condição de preço atual". Plano, pacote ou ação que não
 * existia na fotografia segue o preço atual.
 */
export interface CondicaoPreco {
  capturada_em: string;
  planos: Record<string, { preco_centavos: number; preco_anual_centavos: number | null; creditos_mensais: number }>;
  pacotes: Record<string, { preco_centavos: number; quantidade_creditos: number }>;
  custos: Record<string, number>;
}

/** Lê a tabela de preços de agora (planos, pacotes e custos por ação). */
export async function capturarCondicaoAtual(sb: SupabaseClient): Promise<CondicaoPreco> {
  const [{ data: planos }, { data: pacotes }, { data: custos }] = await Promise.all([
    sb.from("plans").select("id, preco_centavos, preco_anual_centavos, creditos_mensais"),
    sb.from("credit_packages").select("id, preco_centavos, quantidade_creditos"),
    sb.from("credit_costs").select("acao, custo"),
  ]);
  return {
    capturada_em: new Date().toISOString(),
    planos: Object.fromEntries((planos ?? []).map((p) => [p.id, {
      preco_centavos: p.preco_centavos, preco_anual_centavos: p.preco_anual_centavos ?? null, creditos_mensais: p.creditos_mensais,
    }])),
    pacotes: Object.fromEntries((pacotes ?? []).map((p) => [p.id, { preco_centavos: p.preco_centavos, quantidade_creditos: p.quantidade_creditos }])),
    custos: Object.fromEntries((custos ?? []).map((c) => [c.acao, Number(c.custo)])),
  };
}

export function planoNaCondicao<T extends Pick<PlanRow, "id" | "preco_centavos" | "preco_anual_centavos" | "creditos_mensais">>(
  plano: T, condicao: CondicaoPreco | null | undefined,
): T {
  const p = condicao?.planos?.[plano.id];
  return p ? { ...plano, preco_centavos: p.preco_centavos, preco_anual_centavos: p.preco_anual_centavos, creditos_mensais: p.creditos_mensais } : plano;
}

export function pacoteNaCondicao<T extends Pick<CreditPackageRow, "id" | "preco_centavos" | "quantidade_creditos">>(
  pacote: T, condicao: CondicaoPreco | null | undefined,
): T {
  const p = condicao?.pacotes?.[pacote.id];
  return p ? { ...pacote, preco_centavos: p.preco_centavos, quantidade_creditos: p.quantidade_creditos } : pacote;
}

// Lida em todo débito de crédito: cache curto por usuário, como o dos custos.
const cache = new Map<string, { valor: CondicaoPreco | null; expiraEm: number }>();

export async function condicaoDoUsuario(sb: SupabaseClient, userId: string): Promise<CondicaoPreco | null> {
  const c = cache.get(userId);
  if (c && c.expiraEm > Date.now()) return c.valor;
  const { data } = await sb.from("profiles").select("condicao_preco").eq("id", userId).maybeSingle();
  const valor = ((data as { condicao_preco?: CondicaoPreco | null } | null)?.condicao_preco) ?? null;
  cache.set(userId, { valor, expiraEm: Date.now() + 60_000 });
  return valor;
}

export function esquecerCondicao(userId: string) {
  cache.delete(userId);
}
