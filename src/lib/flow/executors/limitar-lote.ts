import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/** Número de um campo do lead ("4,7", "1.234", "R$ 10 mil" → 4.7, 1234, 10); null quando não é número. */
function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
}

function comparar(a: unknown, b: unknown, ordem: "asc" | "desc"): number {
  const vazioA = a === null || a === undefined || String(a).trim() === "";
  const vazioB = b === null || b === undefined || String(b).trim() === "";
  // Lead sem o campo vai pro fim, nas duas ordens.
  if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1;
  const na = numero(a);
  const nb = numero(b);
  const base = na !== null && nb !== null ? na - nb : String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
  return ordem === "asc" ? base : -base;
}

/**
 * Deixa seguir no máximo N leads por execução. É o freio do fluxo: a
 * extração pode trazer 500, mas o disparo só recebe os 40 do dia — os
 * primeiros, um sorteio ou os melhores por um campo (avaliação, número de
 * funcionários, o que vier do enriquecimento).
 */
export async function executarLimitarLote(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const config = (ctx.node.config || {}) as Record<string, unknown>;
  const maximo = Math.max(1, Math.floor(Number(config.maximo) || 0));
  if (!Number.isFinite(maximo) || maximo < 1) return { status: "erro", erro: "Informe quantos leads podem seguir (a partir de 1)." };
  const modo = config.modo === "aleatorio" || config.modo === "ordenar" ? config.modo : "primeiros";
  const campo = String(config.campo || "").trim();
  const ordem = config.ordem === "asc" ? "asc" : "desc";
  if (modo === "ordenar" && !campo) return { status: "erro", erro: "Escolha o campo pra ordenar (ex.: avaliacao)." };

  const lote = [...(ctx.contexto.lote || [])];
  if (modo === "aleatorio") {
    for (let i = lote.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lote[i], lote[j]] = [lote[j], lote[i]];
    }
  } else if (modo === "ordenar") {
    lote.sort((a, b) => comparar(a[campo], b[campo], ordem));
  }
  const saida = lote.slice(0, maximo);

  return {
    status: "concluido",
    leadsEntrada: ctx.contexto.lote?.length ?? 0,
    leadsSaida: saida.length,
    detalhe: { maximo, modo, ...(modo === "ordenar" ? { campo, ordem } : {}), cortados: Math.max(0, lote.length - saida.length) },
    contextoPatch: { lote: saida },
  };
}
