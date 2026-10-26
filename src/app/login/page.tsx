import { Suspense } from "react";
import { MessagesSquare, Search, Send, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "@/components/login/login-form";
import { FONTES_LP } from "../conheca/fontes";
import "../conheca/lp.css";

export const metadata = {
  title: "Entrar",
  description: "Acesse a sua conta do Leadmatic.",
};

/** O que segue rodando na conta enquanto a pessoa está fora (o painel da esquerda). */
const NA_SUA_CONTA: { icone: LucideIcon; titulo: string; texto: string }[] = [
  { icone: MessagesSquare, titulo: "Respostas no funil", texto: "Quem respondeu já está na coluna certa, com a conversa junto." },
  { icone: Send, titulo: "Campanhas e follow-up", texto: "WhatsApp, e-mail e LinkedIn seguem a cadência no dia certo." },
  { icone: Search, titulo: "Empresas novas", texto: "CNPJ e Google Maps, sem repetir quem você já tem na base." },
  { icone: Sparkles, titulo: "Estratégia da IA", texto: "Público, mensagens e cadência prontos para a próxima campanha." },
];

export default function LoginPage() {
  return (
    <div className={`${FONTES_LP} grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}>
      {/* Painel da marca (só em telas largas): o tema escuro da página de vendas. */}
      {/* Fixo na altura da tela: o formulário rola sozinho em telas baixas, e o
          painel nunca empilha o conteúdo por cima da marca. */}
      <aside className="lp relative isolate hidden h-dvh flex-col gap-8 overflow-hidden px-12 py-10 lg:sticky lg:top-0 lg:flex xl:px-16 [@media(max-height:760px)]:gap-6 [@media(max-height:760px)]:py-7">
        <div className="lp-grid absolute inset-0 -z-10" aria-hidden="true" />
        <div className="lp-aurora -z-10 left-[-120px] top-[-160px] h-[520px] w-[520px]" aria-hidden="true" />
        <div className="lp-aurora -z-10 bottom-[-200px] right-[-160px] h-[460px] w-[460px] [--pico:0.22] [animation-delay:-9s]" aria-hidden="true" />

        <div className="flex shrink-0 items-center gap-3">
          <Logo size="lg" />
          <div className="leading-tight">
            <p className="font-lp-display text-lg font-bold tracking-tight text-lp-text">Leadmatic</p>
            <p className="text-xs text-lp-muted-2">por Revolução AI</p>
          </div>
        </div>

        <div className="my-auto max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-lp-line-2 bg-white/[0.03] px-3.5 py-1.5 font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-lp-accent" />
            Área do cliente
          </p>
          <h2 className="mt-6 font-lp-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.035em] text-balance text-lp-text xl:text-[52px] [@media(max-height:760px)]:mt-4 [@media(max-height:760px)]:text-[38px]">
            Sua prospecção continua{" "}
            <span className="font-lp-serif text-[1.06em] font-normal italic tracking-[-0.01em] text-lp-glow">de onde parou.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-lp-muted">
            Entre para ver quem respondeu, o que a IA preparou e as próximas empresas do seu público.
          </p>

          <div className="mt-10 overflow-hidden rounded-[22px] [@media(max-height:820px)]:mt-7 border border-lp-line bg-lp-surface/70 shadow-[0_40px_120px_-50px_rgba(0,200,83,0.35)]">
            <div className="flex items-center gap-2 border-b border-lp-line px-5 py-3 font-lp-mono text-[11px] uppercase tracking-[0.14em] text-lp-muted-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lp-accent opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lp-accent" />
              </span>
              Seguindo enquanto você está fora
            </div>
            <ul className="divide-y divide-lp-line">
              {NA_SUA_CONTA.map(({ icone: Icone, titulo, texto }) => (
                <li key={titulo} className="flex items-start gap-4 px-5 py-4 [@media(max-height:820px)]:py-3 [@media(max-height:700px)]:[&:nth-child(n+3)]:hidden">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lp-accent-soft text-lp-glow">
                    <Icone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-lp-text">{titulo}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-lp-muted">{texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="flex shrink-0 items-center gap-2 text-xs text-lp-muted-2">
          <ShieldCheck className="h-3.5 w-3.5 text-lp-accent" /> Conexão segura. Seus dados e os dos seus leads ficam só na sua conta.
        </p>
      </aside>

      <main className="relative flex items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        <div className="bg-glow h-[360px] w-[360px] -translate-y-1/2 opacity-60 lg:hidden" aria-hidden="true" />
        <div className="relative flex w-full justify-center">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
