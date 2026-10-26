"use client";

import Link from "next/link";
import { ArrowRight, Check, Clock, ShieldCheck, Sparkles, type LucideIcon, Coins, Search, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type MotivoOferta = "sem_creditos" | "encerrado" | "ultimo_dia" | "retorno" | "apos_busca";

/** O que a assinatura libera — a mesma lista em todas as ofertas. */
const BENEFICIOS = [
  "A IA monta a sua estratégia: público, mensagens e cadência",
  "Encontra o sócio e o celular de quem decide em cada empresa",
  "Escreve e envia as mensagens por WhatsApp, e-mail e LinkedIn",
  "Faz o follow-up sozinha e avisa quem respondeu",
  "Funil e automações abordando empresas novas todo dia",
];

export function textoDiasRestantes(dias: number | null): string | null {
  if (dias === null) return null;
  if (dias <= 0) return "último dia";
  return dias === 1 ? "falta 1 dia" : `faltam ${dias} dias`;
}

function conteudo(motivo: MotivoOferta, diasRestantes: number | null): { icone: LucideIcon; titulo: string; texto: string } {
  switch (motivo) {
    case "sem_creditos":
      return {
        icone: Coins,
        titulo: "Os créditos do teste acabaram",
        texto: "Você já viu a qualidade dos contatos. Assinando, os créditos do plano entram na hora e a plataforma inteira é liberada para abordar essas empresas por você.",
      };
    case "encerrado":
      return {
        icone: Hourglass,
        titulo: "O seu teste grátis terminou",
        texto: "As empresas que você encontrou continuam no seu histórico. Assine para continuar de onde parou, agora com a IA fazendo a abordagem e o follow-up.",
      };
    case "ultimo_dia":
      return {
        icone: Clock,
        titulo: "Hoje é o último dia do seu teste",
        texto: "Amanhã a busca fica bloqueada. Assine hoje e continue com tudo o que você já montou, com a plataforma inteira liberada.",
      };
    case "apos_busca":
      return {
        icone: Search,
        titulo: "Achou as empresas. E quem vai abordar todas elas?",
        texto: "No teste, você vê a lista. Com um plano, a IA encontra quem decide em cada empresa, escreve a mensagem e faz o follow-up, todos os dias.",
      };
    default:
      return {
        icone: Sparkles,
        titulo: diasRestantes !== null ? `Seu teste grátis: ${textoDiasRestantes(diasRestantes)}` : "Pronto para liberar a plataforma inteira?",
        texto: "Até aqui você conheceu a busca. O que gera reunião é o resto: a abordagem com o decisor, o follow-up e o funil rodando sozinhos.",
      };
  }
}

function Corpo({ motivo, diasRestantes, precoMinimo, aoContinuar }: { motivo: MotivoOferta; diasRestantes: number | null; precoMinimo: number | null; aoContinuar?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2.5">
        {BENEFICIOS.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {b}
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-primary/30 bg-accent/60 px-4 py-3 text-sm text-accent-foreground">
        {precoMinimo !== null && (
          <p className="font-semibold">
            Planos a partir de {precoMinimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Garantia de 7 dias · mensal sem fidelidade · liberação na hora
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {aoContinuar && motivo !== "encerrado" && (
          <Button variant="outline" onClick={aoContinuar}>
            {motivo === "sem_creditos" ? "Agora não" : "Continuar testando"}
          </Button>
        )}
        <Button asChild>
          <Link href="/creditos" onClick={aoContinuar}>
            Ver planos e assinar <ArrowRight />
          </Link>
        </Button>
      </div>
      {diasRestantes !== null && motivo !== "encerrado" && motivo !== "ultimo_dia" && (
        <p className="text-center text-xs text-muted-foreground">Teste grátis: {textoDiasRestantes(diasRestantes)}.</p>
      )}
    </div>
  );
}

/** Oferta em janela, nos momentos de decisão do teste grátis. */
export function OfertaTeste({
  motivo, diasRestantes, precoMinimo, aoFechar,
}: { motivo: MotivoOferta | null; diasRestantes: number | null; precoMinimo: number | null; aoFechar: () => void }) {
  const c = conteudo(motivo ?? "retorno", diasRestantes);
  const Icone = c.icone;
  return (
    <Dialog open={motivo !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary">
            <Icone className="h-5 w-5" />
          </div>
          <DialogTitle>{c.titulo}</DialogTitle>
          <DialogDescription>{c.texto}</DialogDescription>
        </DialogHeader>
        {motivo && <Corpo motivo={motivo} diasRestantes={diasRestantes} precoMinimo={precoMinimo} aoContinuar={aoFechar} />}
      </DialogContent>
    </Dialog>
  );
}

/** Tela no lugar do conteúdo quando o prazo do teste acaba (planos e perfil continuam abertos). */
export function TesteEncerrado({ precoMinimo }: { precoMinimo: number | null }) {
  const c = conteudo("encerrado", 0);
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
          <Corpo motivo="encerrado" diasRestantes={0} precoMinimo={precoMinimo} />
        </CardContent>
      </Card>
    </div>
  );
}
