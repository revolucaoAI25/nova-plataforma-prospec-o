import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { PageHeader } from "@/components/layout/page-header";
import { PerfilProspeccao } from "@/components/perfil/perfil-prospeccao";
import { obterOnboarding } from "@/lib/onboarding/db";
import { respostasSchema } from "@/lib/onboarding/questionario";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [profile, onboarding] = await Promise.all([getProfile(admin, user.id), obterOnboarding(admin, user.id)]);
  if (!profile) redirect("/login");

  let nomePlano: string | null = null;
  if (profile.plano_id && profile.assinatura_status === "ativa") {
    const { data } = await admin.from("plans").select("nome").eq("id", profile.plano_id).maybeSingle();
    nomePlano = (data as { nome?: string } | null)?.nome ?? null;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description="Seu perfil de prospecção é o que a IA usa pra montar as sugestões, os públicos das buscas e as mensagens. Mudou algo no negócio? Atualize aqui."
      />
      <PerfilProspeccao
        email={profile.email}
        nomePlano={nomePlano}
        creditos={profile.creditos}
        status={onboarding?.status ?? null}
        geradoEm={onboarding?.resultado?.geradoEm ?? null}
        respostasIniciais={respostasSchema.safeParse(onboarding?.respostas ?? {}).data ?? {}}
      />
    </div>
  );
}
