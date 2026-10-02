import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { obterPrimeiraFaturaAssinatura } from "@/lib/integrations/asaas";
import { BoasVindas } from "@/components/lp/boas-vindas";
import { FONTES_LP } from "../conheca/fontes";
import "../conheca/lp.css";

export const metadata: Metadata = { title: { absolute: "Bem-vindo · Leadmatic" }, robots: { index: false } };

/**
 * Para onde a contratação pública (/assinar) leva depois de criar a conta:
 * mostra a fatura enquanto o pagamento não é confirmado e libera o
 * onboarding assim que o webhook do Asaas ativa a assinatura.
 */
export default async function BemVindoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/bem-vindo");

  const admin = createAdminClient();
  const profile = await getProfile(admin, user.id);
  if (!profile) redirect("/login");

  let nomePlano: string | null = null;
  if (profile.plano_id) {
    const { data } = await admin.from("plans").select("nome").eq("id", profile.plano_id).maybeSingle();
    nomePlano = (data as { nome?: string } | null)?.nome ?? null;
  }

  let faturaUrl: string | null = null;
  if (profile.assinatura_status === "pendente" && profile.asaas_subscription_id) {
    faturaUrl = await obterPrimeiraFaturaAssinatura(profile.asaas_subscription_id)
      .then((f) => f?.invoiceUrl ?? null)
      .catch(() => null);
  }

  const primeiroNome = (profile.nome ?? "").trim().split(/\s+/)[0] || null;

  return (
    <div className={`lp ${FONTES_LP} relative flex min-h-screen w-full flex-col`}>
      <div className="lp-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <header className="relative mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
        <span className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full" priority />
          <span className="font-lp-display text-[15px] font-bold tracking-tight">Leadmatic</span>
        </span>
      </header>
      <main className="relative mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-10 sm:px-6">
        <BoasVindas
          primeiroNome={primeiroNome}
          nomePlano={nomePlano}
          statusInicial={profile.assinatura_status}
          faturaUrl={faturaUrl}
        />
      </main>
    </div>
  );
}
