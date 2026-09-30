// Etapas do funil de uma sugestão — sem dependência de servidor, usado
// tanto na aplicação (aplicar.ts) quanto na tela das sugestões.

/** Etapas que a plataforma cria e move sozinha; as do negócio vêm depois (etapasFunil). */
export const ETAPAS_AUTOMATICAS = ["Novos leads", "Em cadência", "Respondeu"] as const;
const ETAPAS_NEGOCIO_PADRAO = ["Em conversa", "Reunião agendada", "Proposta enviada", "Ganho", "Perdido"];

export function etapasDoFunil(plano: { etapasFunil?: string[] }): string[] {
  const automaticas = new Set(ETAPAS_AUTOMATICAS.map((e) => e.toLowerCase()));
  const negocio = Array.from(new Set((plano.etapasFunil ?? []).map((e) => e.trim().slice(0, 40)).filter(Boolean)))
    .filter((e) => !automaticas.has(e.toLowerCase()))
    .slice(0, 5);
  return [...ETAPAS_AUTOMATICAS, ...(negocio.length >= 2 ? negocio : ETAPAS_NEGOCIO_PADRAO)];
}
