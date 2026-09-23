"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Trash2, Eye, Search } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { SearchRow } from "@/lib/database.types";

const FONTE_LABEL: Record<string, string> = { cnpj: "CNPJ", google_maps: "Google Maps", instagram: "Instagram", linkedin: "LinkedIn" };

export function HistoricoTable({ pesquisas }: { pesquisas: SearchRow[] }) {
  const router = useRouter();
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [lista, setLista] = useState(pesquisas);

  async function remover(id: string) {
    if (!confirm("Remover esta pesquisa e todos os leads associados?")) return;
    setRemovendo(id);
    const resp = await fetch(`/api/historico/${id}`, { method: "DELETE" });
    if (resp.ok) {
      setLista((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    }
    setRemovendo(null);
  }

  if (!lista.length) {
    return (
      <EmptyState
        icon={Search}
        title="Nenhuma pesquisa realizada ainda"
        description="Suas buscas por CNPJ, Google Maps e Instagram vão aparecer aqui."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nicho / CNAE</TableHead>
          <TableHead>Localidade</TableHead>
          <TableHead>Fonte</TableHead>
          <TableHead>Leads</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lista.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="max-w-[240px] truncate font-medium">{p.nicho || "—"}</TableCell>
            <TableCell>{p.localidade || "—"}</TableCell>
            <TableCell>
              <Badge variant="outline">{FONTE_LABEL[p.fonte] ?? p.fonte}</Badge>
            </TableCell>
            <TableCell>{p.total_results}</TableCell>
            <TableCell>{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button asChild variant="ghost" size="icon" title="Ver leads">
                  <Link href={`/historico/${p.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="icon" title="Exportar Excel">
                  <a href={`/api/export/${p.id}?formato=xlsx`}>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remover"
                  disabled={removendo === p.id}
                  onClick={() => remover(p.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
