"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Trash2, Eye, Sparkles } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { EnrichmentRunRow } from "@/lib/database.types";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "outline" | "destructive" }> = {
  pendente: { label: "Na fila", variant: "outline" },
  processando: { label: "Processando", variant: "outline" },
  concluido: { label: "Concluído", variant: "success" },
  erro: { label: "Erro", variant: "destructive" },
};

export function EnrichmentRunsTable({ runs }: { runs: EnrichmentRunRow[] }) {
  const router = useRouter();
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [lista, setLista] = useState(runs);

  async function remover(id: string) {
    if (!confirm("Remover esta execução e todos os leads enriquecidos associados?")) return;
    setRemovendo(id);
    const resp = await fetch(`/api/enrichment/${id}`, { method: "DELETE" });
    if (resp.ok) {
      setLista((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    }
    setRemovendo(null);
  }

  if (!lista.length) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Nenhum enriquecimento realizado ainda"
        description="Rode o Enriquecimento com IA em uma lista de leads para ver o histórico aqui."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Leads</TableHead>
          <TableHead>Encontrados</TableHead>
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
              <TableCell>{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button asChild variant="ghost" size="icon" title="Ver leads">
                    <Link href={`/historico/enriquecimento/${r.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {r.status === "concluido" && (
                    <Button asChild variant="ghost" size="icon" title="Exportar Excel">
                      <a href={`/api/enrichment/${r.id}/export`}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
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
