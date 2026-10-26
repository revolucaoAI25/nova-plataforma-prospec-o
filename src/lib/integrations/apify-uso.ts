// Consumo do mês na conta do provedor das buscas de Google Maps, Instagram e
// LinkedIn (GET /users/me/limits): quanto já foi usado em dólares no ciclo
// de cobrança atual e o limite da conta (US$ 5 no plano gratuito).

export interface UsoProvedor {
  usadoUsd: number;
  limiteUsd: number;
  cicloInicio: string;
  cicloFim: string;
}

/** Limite do plano gratuito, se a API não informar outro. */
export const LIMITE_GRATUITO_USD = 5;

export async function obterUsoApify(token: string): Promise<UsoProvedor> {
  const resp = await fetch(`https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(token)}`, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Consulta de uso respondeu ${resp.status}`);
  const d = (await resp.json())?.data ?? {};
  return {
    usadoUsd: Number(d.current?.monthlyUsageUsd ?? 0),
    limiteUsd: Number(d.limits?.maxMonthlyUsageUsd) > 0 ? Number(d.limits.maxMonthlyUsageUsd) : LIMITE_GRATUITO_USD,
    cicloInicio: String(d.monthlyUsageCycle?.startAt ?? ""),
    cicloFim: String(d.monthlyUsageCycle?.endAt ?? ""),
  };
}
