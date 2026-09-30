"use client";

import { useState } from "react";
import { Puzzle, Loader2, ExternalLink, Check } from "lucide-react";
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
import type { AddonRow, AddonSubscriptionStatus, UserAddonSubscriptionRow } from "@/lib/database.types";

const STATUS_LABEL: Record<AddonSubscriptionStatus, { label: string; variant: "success" | "outline" | "destructive" | "secondary" }> = {
  pendente: { label: "Aguardando pagamento", variant: "outline" },
  ativa: { label: "Ativo", variant: "success" },
  inadimplente: { label: "Pagamento pendente", variant: "destructive" },
  cancelada: { label: "Cancelado", variant: "secondary" },
};

function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function limparDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/** Assinatura recorrente de recursos extras à parte do plano — hoje só o disparo por LinkedIn (ver 0025_addon_subscriptions.sql). Mirror de PlanosGrid, mas com status por add-on (Map) em vez de um único status global, já que o usuário pode ter vários add-ons ativos ao mesmo tempo. */
export function AddonsGrid({
  addons,
  assinaturasIniciais,
  temCpfCnpj,
  configurado,
}: {
  addons: AddonRow[];
  assinaturasIniciais: UserAddonSubscriptionRow[];
  temCpfCnpj: boolean;
  configurado: boolean;
}) {
  const confirmar = useConfirm();
  const [statusPorAddon, setStatusPorAddon] = useState<Map<string, AddonSubscriptionStatus>>(
    new Map(assinaturasIniciais.map((a) => [a.addon_id, a.status])),
  );
  const [assinando, setAssinando] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [addonPendenteCpf, setAddonPendenteCpf] = useState<AddonRow | null>(null);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!addons.length) return null;

  async function iniciarAssinatura(addon: AddonRow, cpfCnpjInformado?: string) {
    setErro(null);
    setAviso(null);
    setAssinando(addon.id);
    try {
      const resp = await fetch(`/api/addons/${addon.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cpfCnpjInformado ? { cpfCnpj: cpfCnpjInformado } : {}),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErro(data.error || "Não foi possível iniciar a assinatura.");
        return;
      }
      window.open(data.invoiceUrl, "_blank", "noopener,noreferrer");
      setAviso("Fatura aberta em uma nova aba. Assim que o primeiro pagamento for confirmado, o add-on fica ativo automaticamente.");
      setStatusPorAddon((prev) => new Map(prev).set(addon.id, "pendente"));
      setAddonPendenteCpf(null);
      setCpfCnpj("");
    } catch {
      setErro("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setAssinando(null);
    }
  }

  function clicarAssinar(addon: AddonRow) {
    if (!temCpfCnpj) {
      setAddonPendenteCpf(addon);
      return;
    }
    iniciarAssinatura(addon);
  }

  function confirmarCpfCnpj() {
    const digitos = limparDigitos(cpfCnpj);
    if (digitos.length !== 11 && digitos.length !== 14) {
      setErro("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    if (addonPendenteCpf) iniciarAssinatura(addonPendenteCpf, digitos);
  }

  async function cancelar(addon: AddonRow) {
    if (!(await confirmar({
      title: `Cancelar o add-on "${addon.nome}"?`,
      description: "Encerra a recorrência imediatamente. O acesso concedido não é revogado automaticamente — fale com o admin se precisar remover.",
      destructive: true,
    }))) return;
    setCancelando(addon.id);
    setErro(null);
    const resp = await fetch(`/api/addons/${addon.id}`, { method: "DELETE" });
    setCancelando(null);
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setErro(data.error || "Não foi possível cancelar.");
      return;
    }
    setStatusPorAddon((prev) => new Map(prev).set(addon.id, "cancelada"));
    setAviso("Add-on cancelado.");
  }

  return (
    <div className="flex flex-col gap-4">
      {!configurado && (
        <Alert variant="info">
          <AlertDescription>Assinatura de add-ons ainda não está disponível — em breve.</AlertDescription>
        </Alert>
      )}
      {erro && !addonPendenteCpf && (
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {addons.map((addon) => {
          const status = statusPorAddon.get(addon.id);
          const statusInfo = status ? STATUS_LABEL[status] : null;
          const ativo = status === "ativa" || status === "pendente" || status === "inadimplente";
          return (
            <Card key={addon.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                    <Puzzle className="h-5 w-5" />
                  </div>
                  {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
                </div>
                <CardTitle>{addon.nome}</CardTitle>
                <CardDescription>{addon.descricao}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {formatarPreco(addon.preco_centavos)}
                  <span className="text-sm font-medium text-muted-foreground">/mês</span>
                </p>
                {ativo ? (
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" disabled className="w-full">
                      <Check className="h-4 w-4" /> {status === "pendente" ? "Aguardando pagamento" : "Assinado"}
                    </Button>
                    {(status === "ativa" || status === "inadimplente") && (
                      <Button variant="ghost" size="sm" onClick={() => cancelar(addon)} disabled={cancelando === addon.id}>
                        {cancelando === addon.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Cancelar
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button onClick={() => clicarAssinar(addon)} disabled={!configurado || assinando === addon.id} className="w-full">
                    {assinando === addon.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Puzzle className="h-4 w-4" />}
                    {assinando === addon.id ? "Abrindo…" : "Assinar add-on"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={addonPendenteCpf !== null} onOpenChange={(open) => !open && setAddonPendenteCpf(null)}>
        {addonPendenteCpf && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>CPF ou CNPJ</DialogTitle>
              <DialogDescription>
                Necessário só na primeira cobrança, pra emitir a fatura — fica salvo pras próximas.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 pt-2">
              <Label htmlFor="cpf-cnpj-addon">CPF ou CNPJ</Label>
              <Input
                id="cpf-cnpj-addon"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="Só números"
                onKeyDown={(e) => e.key === "Enter" && confirmarCpfCnpj()}
              />
              {erro && <p className="text-xs text-destructive">{erro}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setAddonPendenteCpf(null)}>Cancelar</Button>
              <Button size="sm" onClick={confirmarCpfCnpj} disabled={assinando === addonPendenteCpf.id}>
                {assinando === addonPendenteCpf.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
