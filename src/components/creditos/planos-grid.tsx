"use client";

import { useState } from "react";
import { Crown, Loader2, ExternalLink, Check, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { PlanRow, AssinaturaStatus } from "@/lib/database.types";

const STATUS_LABEL: Record<AssinaturaStatus, { label: string; variant: "success" | "outline" | "destructive" | "secondary" } | null> = {
  sem_assinatura: null,
  pendente: { label: "Aguardando pagamento", variant: "outline" },
  ativa: { label: "Ativa", variant: "success" },
  inadimplente: { label: "Pagamento pendente", variant: "destructive" },
  cancelada: { label: "Cancelada", variant: "secondary" },
};

function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function limparDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

export function PlanosGrid({
  planos,
  planoAtualId,
  statusAtual,
  temCpfCnpj,
  configurado,
}: {
  planos: PlanRow[];
  planoAtualId: string | null;
  statusAtual: AssinaturaStatus;
  temCpfCnpj: boolean;
  configurado: boolean;
}) {
  const confirmar = useConfirm();
  const [status, setStatus] = useState(statusAtual);
  const [planoId, setPlanoId] = useState(planoAtualId);
  const [assinando, setAssinando] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [planoPendenteCpf, setPlanoPendenteCpf] = useState<PlanRow | null>(null);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const temAssinaturaAtiva = status === "ativa" || status === "pendente" || status === "inadimplente";
  const statusInfo = STATUS_LABEL[status];

  async function iniciarAssinatura(plano: PlanRow, cpfCnpjInformado?: string) {
    setErro(null);
    setAviso(null);
    setAssinando(plano.id);
    try {
      const resp = await fetch("/api/assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plano.id, ...(cpfCnpjInformado ? { cpfCnpj: cpfCnpjInformado } : {}) }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErro(data.error || "Não foi possível iniciar a assinatura.");
        return;
      }
      window.open(data.invoiceUrl, "_blank", "noopener,noreferrer");
      setAviso("Fatura aberta em uma nova aba. Assim que o primeiro pagamento for confirmado, seu plano fica ativo automaticamente.");
      setStatus("pendente");
      setPlanoId(plano.id);
      setPlanoPendenteCpf(null);
      setCpfCnpj("");
    } catch {
      setErro("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setAssinando(null);
    }
  }

  function clicarAssinar(plano: PlanRow) {
    if (!temCpfCnpj) {
      setPlanoPendenteCpf(plano);
      return;
    }
    iniciarAssinatura(plano);
  }

  function confirmarCpfCnpj() {
    const digitos = limparDigitos(cpfCnpj);
    if (digitos.length !== 11 && digitos.length !== 14) {
      setErro("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    if (planoPendenteCpf) iniciarAssinatura(planoPendenteCpf, digitos);
  }

  async function cancelar() {
    if (!(await confirmar({
      title: "Cancelar sua assinatura?",
      description: "Encerra a recorrência imediatamente — você mantém os créditos que já tem, mas não recebe mais a renovação mensal.",
      destructive: true,
    }))) return;
    setCancelando(true);
    setErro(null);
    const resp = await fetch("/api/assinatura", { method: "DELETE" });
    setCancelando(false);
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setErro(data.error || "Não foi possível cancelar.");
      return;
    }
    setStatus("cancelada");
    setAviso("Assinatura cancelada.");
  }

  return (
    <div className="flex flex-col gap-4">
      {!configurado && (
        <Alert variant="info">
          <AlertDescription>Assinatura de plano ainda não está disponível — em breve.</AlertDescription>
        </Alert>
      )}
      {erro && !planoPendenteCpf && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      {aviso && (
        <Alert>
          <ExternalLink className="h-4 w-4" />
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}
      {statusInfo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sua assinatura:</span>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {status === "inadimplente" && (
              <span className="text-xs text-muted-foreground">A última cobrança não foi confirmada — verifique a fatura mais recente.</span>
            )}
          </div>
          {(status === "ativa" || status === "inadimplente") && (
            <Button variant="outline" size="sm" onClick={cancelar} disabled={cancelando}>
              {cancelando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Cancelar assinatura
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planos.map((plano, i) => {
          const destaque = i === 1 && planos.length > 1;
          const ehPlanoAtual = plano.id === planoId && temAssinaturaAtiva;
          return (
            <Card
              key={plano.id}
              className={destaque ? "relative border-primary/40 shadow-[0_0_0_1px_rgba(0,200,83,0.2),var(--elevation-md)]" : "relative"}
            >
              {destaque && !ehPlanoAtual && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                  Mais popular
                </span>
              )}
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                  <Crown className="h-5 w-5" />
                </div>
                <CardTitle>{plano.nome}</CardTitle>
                <CardDescription>{plano.descricao || `${plano.creditos_mensais.toLocaleString("pt-BR")} créditos por mês`}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  {formatarPreco(plano.preco_centavos)}
                  <span className="text-sm font-medium text-muted-foreground">/mês</span>
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Coins className="h-3.5 w-3.5 text-primary" /> {plano.creditos_mensais.toLocaleString("pt-BR")} créditos todo mês
                </p>
                {ehPlanoAtual ? (
                  <Button variant="outline" disabled className="w-full">
                    <Check className="h-4 w-4" /> Seu plano atual
                  </Button>
                ) : (
                  <Button
                    onClick={() => clicarAssinar(plano)}
                    disabled={!configurado || assinando === plano.id || temAssinaturaAtiva}
                    className="w-full"
                    title={temAssinaturaAtiva ? "Cancele sua assinatura atual antes de trocar de plano" : undefined}
                  >
                    {assinando === plano.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                    {assinando === plano.id ? "Abrindo…" : "Assinar"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={planoPendenteCpf !== null} onOpenChange={(open) => !open && setPlanoPendenteCpf(null)}>
        {planoPendenteCpf && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>CPF ou CNPJ</DialogTitle>
              <DialogDescription>
                Necessário só na primeira cobrança, pra emitir a fatura — fica salvo pras próximas.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 pt-2">
              <Label htmlFor="cpf-cnpj-plano">CPF ou CNPJ</Label>
              <Input
                id="cpf-cnpj-plano"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="Só números"
                onKeyDown={(e) => e.key === "Enter" && confirmarCpfCnpj()}
              />
              {erro && <p className="text-xs text-destructive">{erro}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPlanoPendenteCpf(null)}>Cancelar</Button>
              <Button size="sm" onClick={confirmarCpfCnpj} disabled={assinando === planoPendenteCpf.id}>
                {assinando === planoPendenteCpf.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

