import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/layout/page-header";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { listarAplicacoes, obterOnboarding } from "@/lib/onboarding/db";
import { LISTA_CENARIOS } from "@/lib/onboarding/cenarios";
import { respostasSchema } from "@/lib/onboarding/questionario";
import { respostasComDadosDoPerfil } from "@/lib/dados-cliente";
import { getProfile } from "@/lib/credits";

export const metadata = { title: "Estratégia de prospecção" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [onboarding, aplicacoes, profile] = await Promise.all([
    obterOnboarding(admin, user.id), listarAplicacoes(admin, user.id), getProfile(admin, user.id),
  ]);
  const metaCenarios = Object.fromEntries(LISTA_CENARIOS.map((c) => [c.id, { nome: c.nome, etapas: c.etapas, canais: c.canais }]));
  const status = onboarding?.status ?? "rascunho";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Comece aqui"
        title="Sua estratégia de prospecção"
        description={
          status === "pronto"
            ? "Sugestões montadas pra você. Escolha uma (ou mais), siga o passo a passo e dê play."
            : "Responda algumas perguntas sobre o seu negócio. A IA monta sugestões de prospecção sob medida, com automações e mensagens prontas."
        }
      />
      <OnboardingShell
        status={status}
        respostas={respostasComDadosDoPerfil(respostasSchema.safeParse(onboarding?.respostas ?? {}).data ?? {}, profile)}
        resultado={onboarding?.resultado ?? null}
        erro={onboarding?.erro ?? null}
        aplicacoes={aplicacoes.filter((a) => a.geracao === onboarding?.resultado?.geradoEm)}
        metaCenarios={metaCenarios}
      />
    </div>
  );
}
