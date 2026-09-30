import { createAdminClient } from "@/lib/supabase/admin";
import { obterOnboarding } from "./db";
import type { FontePublico, PublicoSugerido } from "./ia";

export interface SugestoesDaBusca {
  publicos: PublicoSugerido[];
  /** Já respondeu o onboarding (mesmo sem público pra essa fonte). */
  temPerfil: boolean;
  /** Sugestões geradas antes de existirem públicos — precisa gerar de novo pra ver. */
  precisaAtualizar?: boolean;
}

/** Públicos que a IA sugeriu pra uma fonte de busca — alimenta o toggle "Sugestões" dos formulários avulsos. */
export async function sugestoesDaBusca(userId: string | undefined, fonte: FontePublico): Promise<SugestoesDaBusca> {
  if (!userId) return { publicos: [], temPerfil: false };
  const onboarding = await obterOnboarding(createAdminClient(), userId);
  return {
    publicos: (onboarding?.resultado?.publicos ?? []).filter((p) => p.fonte === fonte),
    temPerfil: Boolean(onboarding && Object.keys(onboarding.respostas ?? {}).length),
    precisaAtualizar: Boolean(onboarding?.resultado && !onboarding.resultado.publicos),
  };
}
