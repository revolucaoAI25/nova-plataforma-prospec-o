"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Loader2, RefreshCw } from "lucide-react";
import type { AssinaturaStatus } from "@/lib/database.types";

/**
 * Enquanto o pagamento não é confirmado, consulta o status da assinatura a
 * cada poucos segundos (o webhook do Asaas é quem ativa). Pix costuma
 * confirmar em segundos; boleto pode levar até 3 dias úteis — nesse caso
 * a pessoa pode fechar a página e voltar depois.
 */
export function BoasVindas({
  primeiroNome, nomePlano, statusInicial, faturaUrl,
}: {
  primeiroNome: string | null;
  nomePlano: string | null;
  statusInicial: AssinaturaStatus;
  faturaUrl: string | null;
}) {
  const [status, setStatus] = useState(statusInicial);
  const ativa = status === "ativa";

  useEffect(() => {
    if (ativa || status !== "pendente") return;
    const id = setInterval(async () => {
      const resp = await fetch("/api/assinatura", { cache: "no-store" }).catch(() => null);
      const data = await resp?.json().catch(() => null);
      const novo = data?.assinatura?.status as AssinaturaStatus | undefined;
      if (novo) setStatus(novo);
    }, 5000);
    return () => clearInterval(id);
  }, [ativa, status]);

  if (ativa) {
    return (
      <div className="lp-entra w-full rounded-[28px] border border-lp-accent/50 bg-gradient-to-b from-[#0c2318] to-lp-surface p-8 text-center shadow-[0_40px_120px_-40px_rgba(0,200,83,0.6)] sm:p-10">
        <span className="lp-estacao-pulso mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lp-accent text-[#04140a]">
          <Check className="h-7 w-7" strokeWidth={3} />
        </span>
        <h1 className="mt-6 font-lp-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Pagamento confirmado{primeiroNome ? `, ${primeiroNome}` : ""}.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-lp-muted">
          {nomePlano ? `O plano ${nomePlano} está ativo` : "O seu plano está ativo"} e os créditos já estão na sua conta. Agora a IA vai montar a sua
          primeira estratégia de prospecção: são poucas perguntas sobre o seu negócio.
        </p>
        <Link
          href="/onboarding"
          className="group mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-lp-accent px-8 text-base font-semibold text-[#04140a] transition-colors hover:bg-lp-glow"
        >
          Começar o onboarding
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    );
  }

  if (status !== "pendente") {
    return (
      <div className="w-full rounded-[28px] border border-lp-line bg-lp-surface p-8 text-center sm:p-10">
        <h1 className="font-lp-display text-3xl font-extrabold tracking-[-0.03em]">
          {primeiroNome ? `Olá, ${primeiroNome}.` : "Olá."} A sua conta está criada.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-lp-muted">
          Não encontramos uma assinatura aguardando pagamento. Escolha um plano para liberar os créditos e começar.
        </p>
        <Link href="/creditos" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lp-accent px-6 font-semibold text-[#04140a] transition-colors hover:bg-lp-glow">
          Escolher um plano <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="lp-entra w-full rounded-[28px] border border-lp-line-2 bg-lp-surface p-8 sm:p-10">
      <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Conta criada</p>
      <h1 className="mt-3 font-lp-display text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
        {primeiroNome ? `${primeiroNome}, falta só o pagamento.` : "Falta só o pagamento."}
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-lp-muted">
        {nomePlano ? `A assinatura do plano ${nomePlano} foi gerada.` : "A sua assinatura foi gerada."} Conclua o pagamento por Pix, boleto ou
        cartão. Assim que ele for confirmado, esta página libera o acesso automaticamente.
      </p>

      {faturaUrl ? (
        <a
          href={faturaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lp-accent px-6 text-base font-semibold text-[#04140a] shadow-[0_18px_50px_-14px_rgba(0,200,83,0.7)] transition-colors hover:bg-lp-glow"
        >
          Ir para o pagamento
          <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      ) : (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full border border-lp-line-2 px-6 text-base text-lp-text transition-colors hover:border-lp-accent/60"
        >
          <RefreshCw className="h-4 w-4" /> A fatura está sendo gerada. Atualizar
        </button>
      )}

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-lp-line bg-lp-bg/50 px-4 py-3 text-sm text-lp-muted" role="status" aria-live="polite">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lp-accent motion-reduce:animate-none" />
        Aguardando a confirmação do pagamento. Pix é confirmado em instantes; boleto pode levar até 3 dias úteis.
      </div>
      <p className="mt-4 text-[13px] text-lp-muted-2">
        Pode fechar esta página se preferir: quando o pagamento for confirmado, basta entrar na plataforma com o seu e-mail e senha.
      </p>
    </div>
  );
}
