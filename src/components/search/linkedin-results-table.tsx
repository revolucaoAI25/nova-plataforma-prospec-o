import { ExternalLink } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { Lead } from "@/lib/types";

// Colunas específicas do LinkedIn — diferem das colunas genéricas de
// CNPJ/Maps (cargo/empresa atual em vez de CNPJ/CNAE).
export function LinkedInResultsTable({ leads }: { leads: Lead[] }) {
  if (!leads.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Empresa atual</TableHead>
            <TableHead>Localização</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Perfil</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.slice(0, 200).map((lead, i) => (
            <TableRow key={`${lead.linkedin_url || lead.nome || i}-${i}`}>
              <TableCell className="max-w-[180px] truncate font-medium">{lead.nome_completo || lead.nome || "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate">{lead.cargo || "—"}</TableCell>
              <TableCell className="max-w-[180px] truncate">{lead.empresa_atual || "—"}</TableCell>
              <TableCell className="max-w-[160px] truncate">{lead.municipio || "—"}</TableCell>
              <TableCell className="max-w-[180px] truncate">{lead.email || "—"}</TableCell>
              <TableCell>
                {lead.linkedin_url ? (
                  <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    Perfil <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {leads.length > 200 && (
        <p className="text-center text-xs text-muted-foreground">
          Mostrando 200 de {leads.length} resultados — exporte para ver todos.
        </p>
      )}
    </div>
  );
}
