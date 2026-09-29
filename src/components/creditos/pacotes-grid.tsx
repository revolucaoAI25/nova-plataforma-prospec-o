"use client";

import { useState } from "react";
import { Coins, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { CreditPackageRow } from "@/lib/database.types";

function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function limparDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

export function PacotesGrid({
  pacotes,
  temCpfCnpj,
  configurado,
}: {
  pacotes: CreditPackageRow[];
  temCpfCnpj: boolean;
  configurado: boolean;
}) {
  const [comprando, setComprando] = useState<string | null>(null);
  const [pacotePendenteCpf, setPacotePendenteCpf] = useState<CreditPackageRow | null>(null);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function iniciarCompra(pacote: CreditPackageRow, cpfCnpjInformado?: string) {
    setErro(null);
    setAviso(null);
    setComprando(pacote.id);
    try {
      const resp = await fetch("/api/creditos/comprar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pacote.id, ...(cpfCnpjInformado ? { cpfCnpj: cpfCnpjInformado } : {}) }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErro(data.error || "Não foi possível iniciar a compra.");
        return;
      }
      window.open(data.invoiceUrl, "_blank", "noopener,noreferrer");
      setAviso("Fatura aberta em uma nova aba. Assim que o pagamento for confirmado, os créditos entram automaticamente no seu saldo.");
      setPacotePendenteCpf(null);
      setCpfCnpj("");
    } catch {
      setErro("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setComprando(null);
    }
  }

  function clicarComprar(pacote: CreditPackageRow) {
    if (!temCpfCnpj) {
      setPacotePendenteCpf(pacote);
      return;
    }
    iniciarCompra(pacote);
  }

  function confirmarCpfCnpj() {
    const digitos = limparDigitos(cpfCnpj);
    if (digitos.length !== 11 && digitos.length !== 14) {
      setErro("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    if (pacotePendenteCpf) iniciarCompra(pacotePendenteCpf, digitos);
  }

  return (
    <div className="flex flex-col gap-4">
      {!configurado && (
        <Alert variant="info">
          <AlertDescription>Compra de créditos ainda não está disponível — em breve.</AlertDescription>
        </Alert>
      )}
      {erro && !pacotePendenteCpf && (
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
        {pacotes.map((pacote, i) => {
          const destaque = i === 1 && pacotes.length > 1;
          return (
            <Card
              key={pacote.id}
              className={destaque ? "relative border-primary/40 shadow-[0_0_0_1px_rgba(0,200,83,0.2),var(--elevation-md)]" : "relative"}
            >
              {destaque && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                  Mais popular
                </span>
              )}
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                  <Coins className="h-5 w-5" />
                </div>
                <CardTitle>{pacote.nome}</CardTitle>
                <CardDescription>{pacote.quantidade_creditos.toLocaleString("pt-BR")} créditos</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-3xl font-bold tracking-tight text-foreground">{formatarPreco(pacote.preco_centavos)}</p>
                <Button
                  onClick={() => clicarComprar(pacote)}
                  disabled={!configurado || comprando === pacote.id}
                  className="w-full"
                >
                  {comprando === pacote.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                  {comprando === pacote.id ? "Abrindo…" : "Comprar"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={pacotePendenteCpf !== null} onOpenChange={(open) => !open && setPacotePendenteCpf(null)}>
        {pacotePendenteCpf && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>CPF ou CNPJ</DialogTitle>
              <DialogDescription>
                Necessário só na primeira compra, pra emitir a fatura — fica salvo pras próximas.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 pt-2">
              <Label htmlFor="cpf-cnpj">CPF ou CNPJ</Label>
              <Input
                id="cpf-cnpj"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="Só números"
                onKeyDown={(e) => e.key === "Enter" && confirmarCpfCnpj()}
              />
              {erro && <p className="text-xs text-destructive">{erro}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPacotePendenteCpf(null)}>Cancelar</Button>
              <Button size="sm" onClick={confirmarCpfCnpj} disabled={comprando === pacotePendenteCpf.id}>
                {comprando === pacotePendenteCpf.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
