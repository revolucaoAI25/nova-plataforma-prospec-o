import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { carregarPlanosPublicos } from "@/lib/planos-publicos";
import { Checkout } from "@/components/lp/checkout";
import { FONTES_LP } from "../conheca/fontes";
import "../conheca/lp.css";

export const metadata: Metadata = {
  title: { absolute: "Assinar · Leadmatic" },
  description: "Crie a sua conta, conclua o pagamento e comece a prospectar com o Leadmatic.",
  robots: { index: false },
};

export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ plano?: string; ciclo?: string }> }) {
  const { plano, ciclo } = await searchParams;
  const [{ planos }, sessao] = await Promise.all([
    carregarPlanosPublicos(),
    createClient().then((sb) => sb.auth.getUser()).catch(() => null),
  ]);
  const logado = Boolean(sessao?.data.user);

  return (
    <div className={`lp ${FONTES_LP} relative min-h-screen w-full`}>
      <div className="lp-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden="true" />
      <header className="relative border-b border-lp-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/conheca" className="flex items-center gap-2.5" aria-label="Voltar para a página da plataforma">
            <Image src="/logo.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full" priority />
            <span className="font-lp-display text-[15px] font-bold tracking-tight">Leadmatic</span>
          </Link>
          {!logado && (
            <Link href="/login" className="text-sm text-lp-muted transition-colors hover:text-lp-text">
              Já tem conta? <span className="text-lp-glow">Entrar</span>
            </Link>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {logado ? (
          <div className="mx-auto max-w-lg rounded-[28px] border border-lp-line bg-lp-surface p-8 text-center">
            <h1 className="font-lp-display text-2xl font-bold tracking-tight">Você já está conectado à sua conta</h1>
            <p className="mt-3 text-lp-muted">
              Para assinar ou trocar de plano, acesse a área de créditos da plataforma.
            </p>
            <Link
              href="/creditos"
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lp-accent px-6 text-[15px] font-semibold text-[#04140a] transition-colors hover:bg-lp-glow"
            >
              Ir para planos e créditos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : planos.length ? (
          <Checkout planos={planos} planoInicial={plano ?? null} cicloInicial={ciclo === "mensal" ? "mensal" : "anual"} />
        ) : (
          <div className="mx-auto max-w-lg rounded-[28px] border border-lp-line bg-lp-surface p-8 text-center">
            <h1 className="font-lp-display text-2xl font-bold tracking-tight">Contratação indisponível no momento</h1>
            <p className="mt-3 text-lp-muted">Não conseguimos carregar os planos agora. Tente novamente em alguns minutos.</p>
            <Link href="/conheca" className="mt-6 inline-flex text-lp-glow underline-offset-4 hover:underline">Voltar para a página inicial</Link>
          </div>
        )}
      </main>
    </div>
  );
}
