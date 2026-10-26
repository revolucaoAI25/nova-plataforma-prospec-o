"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CreditCard, Hourglass, Lock, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { paginaLiberadaSemAcesso, type MotivoBloqueio } from "@/lib/acesso-regras";

const CONTEUDO: Record<MotivoBloqueio, { icone: LucideIcon; titulo: string; texto: string }> = {
  pagamento_pendente: {
    icone: CreditCard,
    titulo: "Falta só concluir o pagamento",
    texto: "A sua conta está criada. Assim que o pagamento for aprovado, a plataforma é liberada na hora, com os créditos do plano.",
  },
  pagamento_recusado: {
    icone: Lock,
    titulo: "O pagamento da sua assinatura não foi aprovado",
    texto: "Pague a fatura em aberto (pode ser com outro cartão) para voltar a usar a plataforma. As suas listas, campanhas e o funil continuam salvos.",
  },
  plano_encerrado: {
    icone: Hourglass,
    titulo: "O seu plano terminou",
    texto: "Assine de novo para continuar de onde parou. As suas listas, campanhas e o funil continuam salvos.",
  },
  sem_plano: {
    icone: Sparkles,
    titulo: "Escolha um plano para começar",
    texto: "Com um plano, a IA monta a sua estratégia, encontra quem decide em cada empresa e faz a abordagem e o follow-up por você.",
  },
};

function BotaoFatura() {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setAbrindo(true);
    setErro(null);
    const resp = await fetch("/api/assinatura/fatura").catch(() => null);
    const json = await resp?.json().catch(() => null);
    if (json?.invoiceUrl) {
      window.location.href = json.invoiceUrl;
      return;
    }
    setAbrindo(false);
    setErro(json?.error ?? "Não foi possível abrir a fatura agora. Tente de novo em instantes.");
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <Button onClick={abrir} disabled={abrindo}>
        {abrindo ? "Abrindo a fatura…" : "Pagar a fatura"} <ArrowRight />
      </Button>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

/** Tela no lugar do conteúdo para quem não tem acesso (planos e perfil continuam abertos). */
export function AcessoBloqueado({ motivo }: { motivo: MotivoBloqueio }) {
  const c = CONTEUDO[motivo];
  const Icone = c.icone;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6 md:py-12">
      <Card className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary opacity-[0.12] blur-3xl" />
        <CardContent className="flex flex-col gap-5 p-6 md:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary">
            <Icone className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{c.titulo}</h1>
            <p className="text-muted-foreground">{c.texto}</p>
          </div>
          {motivo !== "pagamento_recusado" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Garantia de 7 dias · mensal sem fidelidade · liberação na hora
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {motivo === "pagamento_pendente" ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/creditos">Trocar de plano</Link>
                </Button>
                <Button asChild>
                  <Link href="/bem-vindo">
                    Concluir pagamento <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : motivo === "pagamento_recusado" ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/creditos">Ver minha assinatura</Link>
                </Button>
                <BotaoFatura />
              </>
            ) : (
              <Button asChild>
                <Link href="/creditos">
                  Ver planos e assinar <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Mostra a tela de acesso bloqueado no lugar das páginas que exigem plano. */
export function PortaoAcesso({ motivo, children }: { motivo: MotivoBloqueio; children: React.ReactNode }) {
  const pathname = usePathname();
  if (paginaLiberadaSemAcesso(pathname)) return <>{children}</>;
  return <AcessoBloqueado motivo={motivo} />;
}
