/**
 * Datas sempre no horário de Brasília. Sem o timeZone explícito, o que é
 * renderizado no servidor sai em UTC (o servidor roda em UTC), três horas
 * à frente do horário do cliente.
 */
export const FUSO = "America/Sao_Paulo";

type Entrada = string | number | Date | null | undefined;

function paraData(v: Entrada): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "13/10/2026, 14:32" */
export function formatarDataHora(v: Entrada, vazio = "—"): string {
  const d = paraData(v);
  if (!d) return vazio;
  return d.toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" });
}

/** "13/10/2026" (ou o formato pedido em `opcoes`). */
export function formatarData(v: Entrada, opcoes: Intl.DateTimeFormatOptions = {}, vazio = "—"): string {
  const d = paraData(v);
  if (!d) return vazio;
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO, ...opcoes });
}

/** Data de hoje (ou de `d`) no horário de Brasília, no formato AAAA-MM-DD. */
export function dataISOBrasil(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "20261013-143200", para nomes de arquivo. */
export function carimboBrasil(d: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  return `${v("year")}${v("month")}${v("day")}-${v("hour")}${v("minute")}${v("second")}`;
}
