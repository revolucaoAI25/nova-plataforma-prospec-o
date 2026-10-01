// Ritmo de envio e teste A/B — compartilhado pelos três canais de disparo
// (WhatsApp, e-mail, LinkedIn). As regras de janela e de "novos por dia"
// são aplicadas no banco, dentro das funções de claim (migration 0032); aqui
// fica o que o TypeScript precisa: validação do que a UI manda, o início do
// dia no fuso certo e o sorteio/escolha de variante.

import { z } from "zod";
import type { Variante } from "@/lib/database.types";

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Campos de ritmo aceitos no PATCH das campanhas (todos opcionais; o intervalo mínimo entre envios fica em cada rota, porque o piso muda por canal). */
export const ritmoPatchSchema = {
  limiteNovosPorDia: z.number().int().min(1).max(5000).nullable().optional(),
  janelaInicio: z.string().regex(HORA, "Horário inválido (use HH:MM)").nullable().optional(),
  janelaFim: z.string().regex(HORA, "Horário inválido (use HH:MM)").nullable().optional(),
  janelaDias: z.array(z.number().int().min(1).max(7)).max(7).nullable().optional(),
};

export interface RitmoPatch {
  limiteNovosPorDia?: number | null;
  janelaInicio?: string | null;
  janelaFim?: string | null;
  janelaDias?: number[] | null;
  intervaloMinSeg?: number;
  intervaloMaxSeg?: number;
}

/** Converte o patch da API pras colunas da campanha. Devolve erro legível se a combinação não fizer sentido. */
export function ritmoParaColunas(p: RitmoPatch): { colunas: Record<string, unknown>; erro?: string } {
  const colunas: Record<string, unknown> = {};
  if (p.limiteNovosPorDia !== undefined) colunas.limite_novos_por_dia = p.limiteNovosPorDia;
  if (p.janelaInicio !== undefined) colunas.janela_inicio = p.janelaInicio;
  if (p.janelaFim !== undefined) colunas.janela_fim = p.janelaFim;
  if (p.janelaDias !== undefined) colunas.janela_dias = p.janelaDias ? Array.from(new Set(p.janelaDias)).sort() : null;
  if (p.intervaloMinSeg !== undefined) colunas.intervalo_min_seg = p.intervaloMinSeg;
  if (p.intervaloMaxSeg !== undefined) colunas.intervalo_max_seg = p.intervaloMaxSeg;

  if (p.janelaInicio && p.janelaFim && p.janelaInicio.slice(0, 5) >= p.janelaFim.slice(0, 5)) {
    return { colunas, erro: "O horário de início precisa ser antes do fim." };
  }
  if (p.janelaDias && !p.janelaDias.length) return { colunas, erro: "Escolha pelo menos um dia da semana." };
  if (p.intervaloMinSeg !== undefined && p.intervaloMaxSeg !== undefined && p.intervaloMinSeg > p.intervaloMaxSeg) {
    return { colunas, erro: "O intervalo mínimo não pode ser maior que o máximo." };
  }
  return { colunas };
}

/** Meia-noite de hoje em São Paulo (os limites diários viram o dia junto com o cliente, não às 21h). */
export function inicioDoDiaSP(agora = new Date()): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(agora);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value || 0);
  const decorrido = ((v("hour") * 60 + v("minute")) * 60 + v("second")) * 1000 + agora.getMilliseconds();
  return new Date(agora.getTime() - decorrido);
}

export function sortearVariante(): Variante {
  return Math.random() < 0.5 ? "A" : "B";
}

/**
 * Texto que o alvo recebe: a versão B só quando o alvo caiu em B E a etapa
 * tem texto B. Devolve também a variante efetivamente usada — é ela que vai
 * pro log, então etapa sem teste conta tudo como A.
 */
export function escolherVariante<T>(variante: Variante | null | undefined, textoA: T, textoB: T | null | undefined): { texto: T; variante: Variante } {
  const temB = typeof textoB === "string" ? textoB.trim().length > 0 : textoB !== null && textoB !== undefined;
  if (variante === "B" && temB) return { texto: textoB as T, variante: "B" };
  return { texto: textoA, variante: "A" };
}
