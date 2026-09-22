import { ExternalLink, Users } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import type { LeadRow } from "@/lib/database.types";

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  if (!leads.length) return <EmptyState icon={Users} title="Nenhum lead salvo nesta pesquisa" />;

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>CNPJ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.slice(0, 500).map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="max-w-[220px] truncate font-medium">{lead.nome || "—"}</TableCell>
              <TableCell>{lead.telefone || lead.telefone2 || "—"}</TableCell>
              <TableCell>{[lead.municipio, lead.uf].filter(Boolean).join(" / ") || "—"}</TableCell>
              <TableCell className="max-w-[180px] truncate">{lead.email || "—"}</TableCell>
              <TableCell className="max-w-[160px] truncate">
                {lead.site ? (
                  <a href={lead.site} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    {lead.site.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{lead.cnpj || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {leads.length > 500 && (
        <p className="text-center text-xs text-muted-foreground">
          Mostrando 500 de {leads.length} leads — exporte para ver todos.
        </p>
      )}
    </div>
  );
}
