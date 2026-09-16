import { ExternalLink } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { Lead } from "@/lib/types";

export function ResultsTable({ leads }: { leads: Lead[] }) {
  if (!leads.length) return null;

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Avaliação</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Fonte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.slice(0, 200).map((lead, i) => (
            <TableRow key={`${lead.cnpj || lead.telefone || i}-${i}`}>
              <TableCell className="max-w-[220px] truncate font-medium">{lead.nome || "—"}</TableCell>
              <TableCell>{lead.telefone || lead.telefone2 || "—"}</TableCell>
              <TableCell>
                {[lead.municipio || lead.cidade_busca, lead.uf || lead.estado_busca].filter(Boolean).join(" / ") || "—"}
              </TableCell>
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
              <TableCell>{lead.avaliacao !== "" ? `${lead.avaliacao} (${lead.total_avaliacoes || 0})` : "—"}</TableCell>
              <TableCell>{lead.cnpj || "—"}</TableCell>
              <TableCell>{lead.fonte || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {leads.length > 200 && (
        <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          Mostrando 200 de {leads.length} resultados — exporte para ver todos.
        </p>
      )}
    </div>
  );
}
