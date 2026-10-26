import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { obterPrimeiraFaturaAssinatura } from "@/lib/integrations/asaas";
import { BoasVindas } from "@/components/lp/boas-vindas";
import { RastreamentoLP } from "@/components/rastreamento/rastreamento-lp";
import { configRastreamento } from "@/lib/rastreamento/config";
import { idEventoCompra } from "@/lib/subscriptions-db";
import { planoNaCondicao } from "@/lib/condicao-preco";
import type { PlanRow } from "@/lib/database.types";
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
  let compra: { eventId: string; valor: number; planoId: string; planoNome: string } | null = null;
  if (profile.plano_id) {
    const { data } = await admin.from("plans").select("*").eq("id", profile.plano_id).maybeSingle();
    const plano = data ? planoNaCondicao(data as PlanRow, profile.condicao_preco ?? null) : null;
    nomePlano = plano?.nome ?? null;
    // A compra que o Pixel registra quando o pagamento é aprovado (o webhook manda a mesma pelo servidor).
    if (plano && profile.asaas_subscription_id) {
      const centavos = profile.assinatura_ciclo === "anual" ? (plano.preco_anual_centavos ?? plano.preco_centavos * 12) : plano.preco_centavos;
      compra = { eventId: idEventoCompra(profile.asaas_subscription_id), valor: centavos / 100, planoId: plano.id, planoNome: plano.nome };
    }
  }
  const rastreio = await configRastreamento();

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
      <RastreamentoLP
        pixelId={rastreio.pixelId}
        clarityId={rastreio.clarityId}
        pagina="bem-vindo"
        correspondencia={{
          em: profile.email ?? "",
          ph: (profile.telefone ?? "").replace(/\D/g, ""),
          external_id: profile.id,
        }}
      />
      <main className="relative mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-10 sm:px-6">
        <BoasVindas
          primeiroNome={primeiroNome}
          nomePlano={nomePlano}
          statusInicial={profile.assinatura_status}
          faturaUrl={faturaUrl}
          compra={compra}
        />
      </main>
    </div>
  );
}
