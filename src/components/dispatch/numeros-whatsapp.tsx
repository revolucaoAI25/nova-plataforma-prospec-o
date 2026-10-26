"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, BadgeCheck, Check, Loader2, QrCode, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-provider";
import { ConectarOficial, type InstanciaOficialResumo } from "@/components/dispatch/conectar-oficial";
import type { WhatsappInstanceRow } from "@/lib/database.types";

const STATUS: Record<string, { label: string; variant: "success" | "secondary" | "destructive" }> = {
  conectado: { label: "Conectado", variant: "success" },
  conectando: { label: "Aguardando conexão", variant: "secondary" },
  desconectado: { label: "Desconectado", variant: "destructive" },
};

/** O QR da Evolution expira em ~40 s; renova antes. */
const RENOVAR_QR_MS = 25_000;

function formatarNumero(n: string | null): string | null {
  if (!n) return null;
  const d = n.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith("55")) return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

/**
 * QR Code da instância: tenta de novo até a Evolution gerar (logo depois de
 * criar a instância ela ainda não tem o QR), renova antes de expirar e
 * confere a conexão a cada 4 s.
 */
function QrDaInstancia({ instanceId, aoConectar }: { instanceId: string; aoConectar: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const tentativas = useRef(0);

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout>;
    const buscar = async () => {
      const resp = await fetch(`/api/dispatch/instances/${instanceId}/qrcode`).catch(() => null);
      const d = await resp?.json().catch(() => null);
      if (!ativo) return;
      if (d?.qrcode) {
        tentativas.current = 0;
        setQr(d.qrcode);
        setErro(null);
        timer = setTimeout(buscar, RENOVAR_QR_MS);
        return;
      }
      tentativas.current += 1;
      if (tentativas.current >= 10) {
        setErro(d?.error ? "O serviço de WhatsApp não respondeu. Tente de novo em instantes." : "O QR Code não foi gerado. Feche e tente de novo.");
        return;
      }
      timer = setTimeout(buscar, 2500);
    };
    void buscar();
    const status = setInterval(async () => {
      const resp = await fetch(`/api/dispatch/instances/${instanceId}/status`).catch(() => null);
      const d = await resp?.json().catch(() => null);
      if (ativo && d?.status === "conectado") {
        clearInterval(status);
        aoConectar();
      }
    }, 4000);
    return () => {
      ativo = false;
      clearTimeout(timer);
      clearInterval(status);
    };
  }, [instanceId, aoConectar]);

  if (erro) return <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-border bg-white p-2">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR Code para conectar o WhatsApp" className="h-full w-full" />
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Gerando QR Code…</span>
        )}
      </div>
      <ol className="flex flex-col gap-1 text-sm text-muted-foreground">
        <li>1. Abra o WhatsApp no celular do número que vai disparar.</li>
        <li>2. Toque em <strong className="text-foreground">Aparelhos conectados → Conectar um aparelho</strong>.</li>
        <li>3. Aponte a câmera para o QR Code. Ele se renova sozinho.</li>
      </ol>
    </div>
  );
}

/** Janela de conexão pelo QR Code: cria a instância (nome opcional) e mostra o QR. */
function ConectarQr({
  aberto, instanciaExistente, aoFechar, aoConectar,
}: {
  aberto: boolean;
  instanciaExistente: string | null;
  aoFechar: () => void;
  aoConectar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [limite, setLimite] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(instanciaExistente);
  const [conectado, setConectado] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setCriando(true);
    setErro(null);
    const resp = await fetch("/api/dispatch/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim() || undefined, limiteDiarioEnvios: limite.trim() ? Number(limite) : undefined }),
    }).catch(() => null);
    const json = await resp?.json().catch(() => null);
    setCriando(false);
    if (!resp?.ok) return setErro(json?.error ?? "Não foi possível preparar a conexão. Tente de novo.");
    setInstanceId(json.id);
  }

  const marcarConectado = useCallback(() => {
    setConectado(true);
    aoConectar();
  }, [aoConectar]);

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar pelo QR Code</DialogTitle>
          <DialogDescription>Escaneie com o celular do número que vai enviar as mensagens.</DialogDescription>
        </DialogHeader>
        {conectado ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary"><Check className="h-6 w-6" /></span>
            <p className="font-semibold text-foreground">Número conectado!</p>
            <p className="text-sm text-muted-foreground">Ele já pode ser usado nas campanhas.</p>
            <Button onClick={aoFechar}>Concluir</Button>
          </div>
        ) : instanceId ? (
          <QrDaInstancia instanceId={instanceId} aoConectar={marcarConectado} />
        ) : (
          <form onSubmit={criar} className="flex flex-col gap-4">
            {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-nome">Nome do número (opcional)</Label>
              <Input id="qr-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Comercial" maxLength={60} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-limite">Limite de envios por dia (opcional)</Label>
              <Input id="qr-limite" type="number" min={1} value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Ex.: 80" />
              <p className="text-xs text-muted-foreground">Para número novo, comece com 30 a 50 por dia e aumente aos poucos.</p>
            </div>
            <Button type="submit" disabled={criando}>
              {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} Gerar QR Code
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OpcaoConexao({
  icone: Icone, titulo, selo, seloOficial, texto, pontos, alerta, acao,
}: {
  icone: typeof QrCode;
  titulo: string;
  selo: string;
  seloOficial?: boolean;
  texto: string;
  pontos: string[];
  alerta?: string;
  acao: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary"><Icone className="h-5 w-5" /></span>
        <Badge variant={seloOficial ? "success" : "outline"}>{selo}</Badge>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {pontos.map((p) => (
          <li key={p} className="flex items-start gap-2 text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p}</li>
        ))}
        {alerta && (
          <li className="flex items-start gap-2 text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {alerta}</li>
        )}
      </ul>
      <div className="mt-auto pt-1">{acao}</div>
    </section>
  );
}

export function NumerosWhatsapp({
  instanciasIniciais,
  oficial,
  abrirOficial = false,
}: {
  instanciasIniciais: WhatsappInstanceRow[];
  oficial: { disponivel: boolean; pode: boolean; ehAdmin: boolean; instancias: InstanciaOficialResumo[] };
  abrirOficial?: boolean;
}) {
  const router = useRouter();
  const confirmar = useConfirm();
  // A lista vem do servidor (router.refresh depois de conectar); removidos somem na hora.
  const [removidos, setRemovidos] = useState<Set<string>>(() => new Set());
  const instancias = instanciasIniciais.filter((i) => !removidos.has(i.id));
  const [qrAberto, setQrAberto] = useState<{ existente: string | null } | null>(null);
  const [oficialAberto, setOficialAberto] = useState(abrirOficial && oficial.disponivel);

  // Números conectados antes da detecção de respostas: a checagem de status registra o webhook.
  useEffect(() => {
    for (const inst of instanciasIniciais) {
      if (inst.canal === "evolution" && inst.status === "conectado" && !inst.webhook_configurado_em) {
        void fetch(`/api/dispatch/instances/${inst.id}/status`).catch(() => {});
      }
    }
  }, [instanciasIniciais]);

  const atualizar = useCallback(() => router.refresh(), [router]);

  async function remover(inst: WhatsappInstanceRow) {
    const ok = await confirmar({
      title: "Remover este número?",
      description: inst.canal === "oficial"
        ? "O número sai da API oficial nesta plataforma e as campanhas que usam ele param de enviar."
        : "O WhatsApp é desconectado desta plataforma e as campanhas que usam ele param de enviar.",
      destructive: true,
    });
    if (!ok) return;
    await fetch(`/api/dispatch/instances/${inst.id}`, { method: "DELETE" });
    setRemovidos((atual) => new Set(atual).add(inst.id));
    atualizar();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 lg:grid-cols-2" data-guia="conexao_whatsapp">
        <OpcaoConexao
          icone={QrCode}
          titulo="WhatsApp pelo QR Code"
          selo="Não oficial"
          texto="Conecte qualquer número em 1 minuto, escaneando um QR Code com o celular."
          pontos={["Conexão na hora, sem aprovação", "Sem custo por mensagem"]}
          alerta="Há risco de bloqueio se o número enviar muito: use um número aquecido e respeite o limite diário."
          acao={
            <Button onClick={() => setQrAberto({ existente: null })} className="w-full sm:w-auto">
              <QrCode className="h-4 w-4" /> Conectar pelo QR Code
            </Button>
          }
        />
        <OpcaoConexao
          icone={BadgeCheck}
          titulo="API oficial do WhatsApp"
          selo="Oficial · Meta"
          seloOficial
          texto="O seu número conectado direto à Meta, pela conta da sua empresa. Pode ser o número que você já usa no WhatsApp Business."
          pontos={["Sem risco de bloqueio do número", "Status de entrega e leitura", "Mensagens com templates aprovados pela Meta"]}
          alerta="A Meta cobra cada conversa iniciada, no cartão da sua conta."
          acao={
            !oficial.disponivel ? (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/disparo/solicitar-oficial">Solicitar API oficial <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            ) : oficial.pode ? (
              <Button onClick={() => setOficialAberto(true)} className="w-full sm:w-auto">
                <BadgeCheck className="h-4 w-4" /> Conectar API oficial
              </Button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/creditos?aba=extras">Liberar a API oficial <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <span className="text-xs text-muted-foreground">Incluso nos planos Pro e Business.</span>
              </div>
            )
          }
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Seus números</h2>
        {instancias.length === 0 ? (
          <EmptyState icon={Smartphone} title="Nenhum número conectado ainda" description="Conecte um número acima para começar a disparar." className="rounded-2xl border border-dashed border-border py-10" />
        ) : (
          <ul className="flex flex-col gap-2">
            {instancias.map((inst) => {
              const status = STATUS[inst.status] ?? { label: inst.status, variant: "secondary" as const };
              return (
                <li key={inst.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                      {inst.canal === "oficial" ? <BadgeCheck className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        <span className="truncate">{inst.nome}</span>
                        <Badge variant="outline" className="text-[11px]">{inst.canal === "oficial" ? "API oficial" : "QR Code"}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[formatarNumero(inst.numero_conectado), inst.limite_diario_envios ? `até ${inst.limite_diario_envios} envios/dia` : null].filter(Boolean).join(" · ") || "Número ainda não conectado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {inst.canal === "evolution" && inst.status !== "conectado" && (
                      <Button size="sm" variant="outline" onClick={() => setQrAberto({ existente: inst.id })}>
                        <RefreshCw className="h-3.5 w-3.5" /> Reconectar
                      </Button>
                    )}
                    {inst.canal === "oficial" && inst.status !== "conectado" && oficial.disponivel && (
                      <Button size="sm" variant="outline" onClick={() => setOficialAberto(true)}>
                        {inst.status === "conectando" ? "Concluir conexão" : "Reativar"}
                      </Button>
                    )}
                    <Button aria-label="Remover número" title="Remover" variant="ghost" size="icon" onClick={() => remover(inst)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {qrAberto && (
        <ConectarQr
          key={qrAberto.existente ?? "novo"}
          aberto
          instanciaExistente={qrAberto.existente}
          aoFechar={() => {
            setQrAberto(null);
            atualizar();
          }}
          aoConectar={atualizar}
        />
      )}

      <Dialog open={oficialAberto} onOpenChange={setOficialAberto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>API oficial do WhatsApp</DialogTitle>
            <DialogDescription>Conecte o número da sua empresa à API oficial.</DialogDescription>
          </DialogHeader>
          <ConectarOficial pode={oficial.pode} instancias={oficial.instancias} ehAdmin={oficial.ehAdmin} embutido aoConectar={atualizar} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
