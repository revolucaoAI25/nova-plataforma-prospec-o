"use client";

import { useState } from "react";
import { History, RefreshCw, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { CreditPurchaseRow, CreditPurchaseStatus } from "@/lib/database.types";

const STATUS_LABEL: Record<CreditPurchaseStatus, { label: string; variant: "success" | "outline" | "destructive" | "secondary" }> = {
  pendente: { label: "Aguardando pagamento", variant: "outline" },
  pago: { label: "Pago", variant: "success" },
  falhou: { label: "Falhou", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "secondary" },
};

function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function HistoricoCompras({ comprasIniciais }: { comprasIniciais: CreditPurchaseRow[] }) {
  const [compras, setCompras] = useState(comprasIniciais);
  const [atualizando, setAtualizando] = useState(false);

  async function atualizar() {
    setAtualizando(true);
    const resp = await fetch("/api/creditos");
    if (resp.ok) {
      const data = await resp.json();
      setCompras(data.compras || []);
    }
    setAtualizando(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Histórico de compras
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={atualizar} disabled={atualizando}>
          <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {compras.length === 0 ? (
          <EmptyState icon={History} title="Nenhuma compra ainda" description="Seus pedidos de créditos avulsos vão aparecer aqui." />
        ) : (
          <ul className="flex flex-col gap-1">
            {compras.map((c) => {
              const status = STATUS_LABEL[c.status];
              return (
                <li key={c.id} className="flex items-center justify-between gap-4 rounded-xl px-2.5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{c.quantidade_creditos.toLocaleString("pt-BR")} créditos</p>
                    <p className="text-muted-foreground">
                      {formatarPreco(c.preco_centavos)} · {new Date(c.criado_em).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.status === "pendente" && c.invoice_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={c.invoice_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> Ver fatura
                        </a>
                      </Button>
                    )}
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
