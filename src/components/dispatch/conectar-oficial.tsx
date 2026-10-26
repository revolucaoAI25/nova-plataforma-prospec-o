"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, ExternalLink, Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Origem da janela de conexão da Datafy (a mensagem de conclusão só vale vinda dela). */
const ORIGEM_DATAFY = "https://app.datafyapi.com.br";
const GUIA_PAGAMENTO = "https://developers.datafyapi.com.br/guias/meta/pagamento";

export interface InstanciaOficialResumo {
  id: string;
  status: string;
  numero_conectado: string | null;
  nome: string;
}

type Etapa = "inicial" | "abrindo" | "aguardando" | "verificando" | "conectado";

function formatarNumero(n: string | null): string | null {
  if (!n) return null;
  const d = n.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith("55")) return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

function Passos() {
  return (
    <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
      <li className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">1</span>
        <span>
          Entre com o seu Facebook e escolha a <strong className="text-foreground">conta empresarial (BM)</strong> da sua empresa. Se ainda não
          tiver, dá para criar na própria janela.
        </span>
      </li>
      <li className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">2</span>
        <span>
          Informe o número: pode ser um <strong className="text-foreground">chip novo</strong> ou o número que você já usa no{" "}
          <strong className="text-foreground">WhatsApp Business</strong> (ele continua funcionando no celular).
        </span>
      </li>
      <li className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">3</span>
        <span>Confirme o código que chega no número. A janela fecha sozinha e o número aparece aqui, pronto para as campanhas.</span>
      </li>
    </ol>
  );
}

export function ConectarOficial({
  pode,
  instancias,
  ehAdmin,
}: {
  pode: boolean;
  instancias: InstanciaOficialResumo[];
  ehAdmin: boolean;
}) {
  const conectada = instancias.find((i) => i.status === "conectado") ?? null;
  const pendente = instancias.find((i) => i.status === "conectando") ?? null;
  const pausada = instancias.find((i) => i.status === "desconectado") ?? null;

  const [etapa, setEtapa] = useState<Etapa>(conectada ? "conectado" : "inicial");
  const [numero, setNumero] = useState<string | null>(conectada?.numero_conectado ?? null);
  const [instanceId, setInstanceId] = useState<string | null>(pendente?.id ?? null);
  const [linkManual, setLinkManual] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const janelaRef = useRef<Window | null>(null);
  const instanceRef = useRef<string | null>(instanceId);
  useEffect(() => {
    instanceRef.current = instanceId;
  }, [instanceId]);

  const verificar = useCallback(async (id?: string | null) => {
    const alvo = id ?? instanceRef.current;
    if (!alvo) return;
    setEtapa("verificando");
    setErro(null);
    const resp = await fetch("/api/dispatch/oficial/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId: alvo }),
    }).catch(() => null);
    const json = await resp?.json().catch(() => null);
    if (!resp?.ok) {
      setEtapa("aguardando");
      setErro(json?.error ?? "Não foi possível verificar a conexão agora.");
      return;
    }
    if (json.conectado) {
      setNumero(json.numero);
      setEtapa("conectado");
      setAviso(null);
    } else {
      setEtapa("aguardando");
      setAviso("A conexão ainda não foi concluída. Termine o processo na janela da Meta e clique em “Verificar conexão”.");
    }
  }, []);

  // A janela de conexão avisa a página quando termina (só vale a mensagem vinda da Datafy).
  useEffect(() => {
    const aoReceber = (evento: MessageEvent) => {
      if (evento.origin !== ORIGEM_DATAFY || evento.data?.source !== "datafy") return;
      if (evento.data.event === "connected") void verificar();
      if (evento.data.event === "error") setErro(evento.data.message || "A Meta não concluiu a conexão. Tente de novo na janela.");
    };
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, [verificar]);

  // Janela fechada sem aviso: confere uma vez se a conexão foi feita.
  useEffect(() => {
    if (etapa !== "aguardando") return;
    const id = setInterval(() => {
      if (janelaRef.current?.closed) {
        janelaRef.current = null;
        void verificar();
      }
    }, 1500);
    return () => clearInterval(id);
  }, [etapa, verificar]);

  async function conectar() {
    setErro(null);
    setAviso(null);
    setLinkManual(null);
    setEtapa("abrindo");
    // Abre a janela já no clique (depois da resposta o navegador bloquearia).
    const janela = window.open("about:blank", "datafy-conexao", "width=600,height=760");
    const resp = await fetch("/api/dispatch/oficial/conectar", { method: "POST" }).catch(() => null);
    const json = await resp?.json().catch(() => null);
    if (!resp?.ok) {
      janela?.close();
      setEtapa("inicial");
      setErro(json?.error ?? "Não foi possível iniciar a conexão agora.");
      return;
    }
    if (json.reativado) {
      janela?.close();
      setNumero(json.numero);
      setEtapa("conectado");
      return;
    }
    setInstanceId(json.instanceId);
    if (janela && !janela.closed) {
      janela.location.href = json.url;
      janelaRef.current = janela;
    } else {
      setLinkManual(json.url);
    }
    setEtapa("aguardando");
  }

  if (!pode) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary"><Lock className="h-5 w-5" /></span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold text-foreground">A API oficial faz parte dos planos Pro e Business</h2>
          <p className="text-sm text-muted-foreground">
            No plano Starter, ative o add-on <strong className="text-foreground">WhatsApp API oficial</strong>: você conecta o seu número aqui
            mesmo, em poucos minutos, sem risco de bloqueio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/creditos?aba=extras">Ativar o add-on <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/creditos">Ver planos</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (etapa === "conectado" && !ehAdmin) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-primary/40 bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary"><CheckCircle2 className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Número oficial conectado</h2>
            <p className="text-sm text-muted-foreground">{formatarNumero(numero) ?? "WhatsApp oficial"} · pronto para as campanhas</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
          <p className="font-semibold text-foreground">Antes de disparar</p>
          <p className="text-muted-foreground">
            1. Cadastre um cartão na sua conta do WhatsApp na Meta: é por ele que a Meta cobra as mensagens.{" "}
            <a href={GUIA_PAGAMENTO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Como fazer <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <p className="text-muted-foreground">
            2. Crie os templates de mensagem em Disparo → Templates. Na API oficial, o primeiro contato com um lead é sempre por template aprovado pela
            Meta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/disparo">Ir para o Disparo <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary"><BadgeCheck className="h-5 w-5" /></span>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {pausada && !pendente ? "Reativar o seu número oficial" : "Conectar o WhatsApp oficial"}
          </h2>
          <p className="text-sm text-muted-foreground">Leva poucos minutos e é feito na janela oficial da Meta.</p>
        </div>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      {aviso && (
        <Alert>
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {!(pausada && !pendente) && <Passos />}

      {linkManual && (
        <Alert>
          <AlertDescription>
            O navegador bloqueou a janela.{" "}
            <a href={linkManual} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
              Abrir a janela de conexão
            </a>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={conectar} disabled={etapa === "abrindo" || etapa === "verificando"}>
          {etapa === "abrindo" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {etapa === "aguardando" ? "Abrir a janela de novo" : pausada && !pendente ? "Reativar número" : pendente ? "Continuar conexão" : "Conectar WhatsApp oficial"}
        </Button>
        {(etapa === "aguardando" || etapa === "verificando" || pendente) && (
          <Button variant="outline" onClick={() => verificar()} disabled={etapa === "verificando" || !instanceId}>
            {etapa === "verificando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Verificar conexão
          </Button>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> O número fica na conta da sua empresa na Meta. A Meta cobra as mensagens à parte, no
        cartão cadastrado por você.
      </p>
    </div>
  );
}
