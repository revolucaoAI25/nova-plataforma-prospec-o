/**
 * Limite simples de tentativas por chave (ex.: IP) numa janela de tempo,
 * em memória. Vale por instância do servidor — não é uma barreira contra
 * ataque distribuído, só segura repetição e robôs simples em rotas
 * públicas (cadastro). Entradas vencidas são limpas a cada chamada.
 */
// Cada chave guarda a própria janela: a limpeza de uma rota com janela curta
// não pode apagar o histórico de outra com janela longa.
const registros = new Map<string, { janelaMs: number; tempos: number[] }>();

export function dentroDoLimite(chave: string, maximo: number, janelaMs: number): boolean {
  const agora = Date.now();
  for (const [k, r] of registros) {
    const vivos = r.tempos.filter((t) => agora - t < r.janelaMs);
    if (vivos.length) r.tempos = vivos;
    else registros.delete(k);
  }
  const tempos = registros.get(chave)?.tempos ?? [];
  if (tempos.length >= maximo) return false;
  registros.set(chave, { janelaMs, tempos: [...tempos, agora] });
  return true;
}

/** IP de quem chamou, pelo primeiro valor de x-forwarded-for (proxy do Railway). */
export function ipDaRequisicao(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "desconhecido";
}
