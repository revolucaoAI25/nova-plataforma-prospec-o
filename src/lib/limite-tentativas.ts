/**
 * Limite simples de tentativas por chave (ex.: IP) numa janela de tempo,
 * em memória. Vale por instância do servidor — não é uma barreira contra
 * ataque distribuído, só segura repetição e robôs simples em rotas
 * públicas (cadastro). Entradas vencidas são limpas a cada chamada.
 */
const registros = new Map<string, number[]>();

export function dentroDoLimite(chave: string, maximo: number, janelaMs: number): boolean {
  const agora = Date.now();
  for (const [k, tempos] of registros) {
    const vivos = tempos.filter((t) => agora - t < janelaMs);
    if (vivos.length) registros.set(k, vivos);
    else registros.delete(k);
  }
  const tempos = registros.get(chave) ?? [];
  if (tempos.length >= maximo) return false;
  registros.set(chave, [...tempos, agora]);
  return true;
}

/** IP de quem chamou, pelo primeiro valor de x-forwarded-for (proxy do Railway). */
export function ipDaRequisicao(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "desconhecido";
}
