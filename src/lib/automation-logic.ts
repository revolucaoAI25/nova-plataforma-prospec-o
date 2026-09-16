// Cálculo de agendamento de automações — portado de modules/scheduler.py.
// Brasil aboliu o horário de verão em 2019, então America/Sao_Paulo é
// permanentemente UTC-3 — um offset fixo é seguro (mesmo fallback que o
// produto atual já usava quando zoneinfo não estava disponível).
const BRAZIL_OFFSET_MS = -3 * 60 * 60 * 1000;

function agoraBrasilComponents(): { y: number; mo: number; d: number; h: number; mi: number; weekdayPython: number } {
  const nowBrazil = new Date(Date.now() + BRAZIL_OFFSET_MS);
  return {
    y: nowBrazil.getUTCFullYear(),
    mo: nowBrazil.getUTCMonth(),
    d: nowBrazil.getUTCDate(),
    h: nowBrazil.getUTCHours(),
    mi: nowBrazil.getUTCMinutes(),
    weekdayPython: (nowBrazil.getUTCDay() + 6) % 7, // 0=Seg...6=Dom (convenção Python)
  };
}

/** Constrói um Date UTC a partir de ano/mês/dia/hora/min no horário de Brasília. */
function brasilParaUtc(y: number, mo: number, d: number, h: number, mi: number): Date {
  return new Date(Date.UTC(y, mo, d, h, mi, 0) - BRAZIL_OFFSET_MS);
}

/**
 * Calcula o próximo Date (UTC) em que a automação deve rodar.
 * diasSemana: 0=Dom, 1=Seg, ..., 6=Sáb. horario: "HH:MM" ou múltiplos
 * separados por vírgula "08:00,14:00,20:00".
 */
export function calcularProximaExecucao(diasSemana: number[], horario: string): Date | null {
  if (!diasSemana?.length || !horario) return null;

  const horarios = horario.split(",").map((h) => h.trim()).filter(Boolean);
  const agora = new Date();
  const agoraBrasil = agoraBrasilComponents();
  let melhor: Date | null = null;

  for (const hStr of horarios) {
    const [hStrH, hStrM] = hStr.split(":");
    const h = Number(hStrH);
    const m = Number(hStrM || "0");
    if (Number.isNaN(h) || Number.isNaN(m)) continue;

    for (let delta = 0; delta < 8; delta++) {
      const dataCand = new Date(Date.UTC(agoraBrasil.y, agoraBrasil.mo, agoraBrasil.d + delta));
      const pythonWd = (dataCand.getUTCDay() + 6) % 7; // 0=Seg...6=Dom
      const nossoWd = (pythonWd + 1) % 7; // 0=Dom...6=Sáb

      if (!diasSemana.includes(nossoWd)) continue;

      const dtCand = brasilParaUtc(dataCand.getUTCFullYear(), dataCand.getUTCMonth(), dataCand.getUTCDate(), h, m);
      if (dtCand > agora) {
        if (!melhor || dtCand < melhor) melhor = dtCand;
        break;
      }
    }
  }

  return melhor;
}

export function formatarHorarios(horario: string): string {
  const times = (horario || "").split(",").map((h) => h.trim()).filter(Boolean);
  if (!times.length) return "—";
  if (times.length === 1) return times[0];
  return `${times.slice(0, -1).join(", ")} e ${times[times.length - 1]}`;
}

export function formatarProximaExecucao(proximaIso: string | null): string {
  if (!proximaIso) return "Não agendada";
  const dt = new Date(proximaIso);
  const diffMin = Math.round((dt.getTime() - Date.now()) / 60000);

  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Em ${diffMin} min`;
  if (diffMin < 1440) return `Em ${Math.floor(diffMin / 60)}h`;

  const horaBrasil = new Date(dt.getTime() + BRAZIL_OFFSET_MS);
  const hh = String(horaBrasil.getUTCHours()).padStart(2, "0");
  const mm = String(horaBrasil.getUTCMinutes()).padStart(2, "0");
  if (diffMin < 2880) return `Amanhã às ${hh}:${mm}`;
  return `Em ${Math.floor(diffMin / 1440)} dias às ${hh}:${mm}`;
}

const NOMES_DIAS: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

export function formatarDias(diasSemana: number[]): string {
  if (!diasSemana?.length) return "Nenhum dia";
  const ordenado = [...diasSemana].sort();
  if (JSON.stringify(ordenado) === JSON.stringify([1, 2, 3, 4, 5])) return "Seg–Sex";
  if (JSON.stringify(ordenado) === JSON.stringify([0, 6])) return "Sáb e Dom";
  if (JSON.stringify(ordenado) === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) return "Todos os dias";
  return ordenado.map((d) => NOMES_DIAS[d] ?? String(d)).join(", ");
}
