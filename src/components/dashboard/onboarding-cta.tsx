import Link from "next/link";
import { ArrowRight, Compass, Loader2, Rocket, Sparkles } from "lucide-react";
import type { OnboardingStatus } from "@/lib/onboarding/db";
import type { AplicacaoRow } from "@/lib/onboarding/aplicar";

/**
 * Chamada pro onboarding na visão geral. Muda conforme onde o cliente
 * parou; some quando já existe um plano rodando.
 */
export function OnboardingCta({ status, aplicacoes }: { status: OnboardingStatus | null; aplicacoes: AplicacaoRow[] }) {
  if (aplicacoes.some((a) => a.status === "ativo")) return null;

  const emConfiguracao = aplicacoes.find((a) => a.status === "aguardando_conexoes");
  const conteudo = emConfiguracao
    ? { icon: Rocket, titulo: `Continue configurando o Plano ${emConfiguracao.letra}`, texto: "Faltam só as conexões. Siga o passo a passo e dê play.", acao: "Continuar" }
    : status === "gerando"
      ? { icon: Loader2, titulo: "Seus planos estão sendo montados", texto: "A IA está escolhendo os caminhos e escrevendo as mensagens. Leva 1 a 3 minutos.", acao: "Acompanhar" }
      : status === "pronto"
        ? { icon: Sparkles, titulo: "Seus planos de prospecção estão prontos", texto: "Compare os planos A, B, C e D, veja as mensagens e escolha um pra começar.", acao: "Ver planos" }
        : { icon: Compass, titulo: "Monte seu plano de prospecção em 5 minutos", texto: "Responda algumas perguntas sobre o seu negócio. A IA monta planos sob medida — extração, mensagens e automação — prontos pra dar play.", acao: "Começar" };
  const Icone = conteudo.icon;

  return (
    <Link
      href="/onboarding"
      className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-primary/40 bg-card p-5 shadow-[var(--elevation-md)] transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-primary opacity-[0.12] blur-3xl" />
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
        <Icone className={status === "gerando" && !emConfiguracao ? "h-6 w-6 animate-spin" : "h-6 w-6"} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base font-semibold text-foreground">{conteudo.titulo}</p>
        <p className="text-sm text-muted-foreground">{conteudo.texto}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground sm:self-center">
        {conteudo.acao} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
