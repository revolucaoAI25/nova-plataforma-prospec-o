import type { SupabaseClient } from "@supabase/supabase-js";
import type { AplicacaoRow } from "./aplicar";
import type { ResultadoOnboarding } from "./ia";
import type { RespostasOnboarding } from "./questionario";

export type OnboardingStatus = "rascunho" | "gerando" | "pronto" | "erro";

export interface OnboardingRow {
  user_id: string;
  respostas: RespostasOnboarding;
  status: OnboardingStatus;
  resultado: ResultadoOnboarding | null;
  erro: string | null;
  tentativas: number;
  solicitado_em: string | null;
  processando_desde: string | null;
  gerado_em: string | null;
  atualizado_em: string;
}

export async function obterOnboarding(sb: SupabaseClient, userId: string): Promise<OnboardingRow | null> {
  const { data } = await sb.from("onboarding").select("*").eq("user_id", userId).maybeSingle();
  return (data as OnboardingRow | null) ?? null;
}

export async function listarAplicacoes(sb: SupabaseClient, userId: string): Promise<AplicacaoRow[]> {
  const { data } = await sb.from("onboarding_aplicacoes").select("*").eq("user_id", userId).order("letra");
  return (data as AplicacaoRow[]) ?? [];
}
