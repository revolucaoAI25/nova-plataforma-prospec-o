"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Eye, Database } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { BigDataCorpEnrichmentRunRow } from "@/lib/database.types";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "outline" | "destructive" }> = {
  pendente: { label: "Na fila", variant: "outline" },
  processando: { label: "Processando", variant: "outline" },
  concluido: { label: "Concluído", variant: "success" },
  erro: { label: "Erro", variant: "destructive" },
};

export function BigDataCorpRunsTable({ runs }: { runs: BigDataCorpEnrichmentRunRow[] }) {
  const router = useRouter();
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [lista, setLista] = useState(runs);

  async function remover(id: string) {
    if (!confirm("Remover esta execução e todos os resultados associados?")) return;
    setRemovendo(id);
    const resp = await fetch(`/api/bigdatacorp-enrichment/${id}`, { method: "DELETE" });
    if (resp.ok) {
      setLista((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    }
    setRemovendo(null);
  }

  if (!lista.length) {
    return (
      <EmptyState
        icon={Database}
        title="Nenhum enriquecimento por CNPJ realizado ainda"
        description="Cole uma lista de CNPJs em Enriquecimento → Sócios e Contato (BigDataCorp) para ver o histórico aqui."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>CNPJs</TableHead>
          <TableHead>Encontrados</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lista.map((r) => {
          const status = STATUS_LABEL[r.status] ?? STATUS_LABEL.pendente;
          return (
            <TableRow key={r.id}>
              <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
              <TableCell>{r.total}</TableCell>
              <TableCell>{r.encontrados}</TableCell>
              <TableCell className="capitalize">{r.origem.replace("_", " ")}</TableCell>
              <TableCell>{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button asChild variant="ghost" size="icon" title="Ver resultado">
                    <Link href={`/historico/bigdatacorp/${r.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remover"
                    disabled={removendo === r.id}
                    onClick={() => remover(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
