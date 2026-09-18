import { ExternalLink, BadgeCheck } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { Lead } from "@/lib/types";

// Colunas específicas do Instagram (app.py `pagina_busca`, tab Instagram,
// _insta_vis / _lm_insta) — diferem das colunas genéricas de CNPJ/Maps.
export function InstagramResultsTable({ leads }: { leads: Lead[] }) {
  if (!leads.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username / @handle</TableHead>
            <TableHead>Instagram ID</TableHead>
            <TableHead>Nome Completo</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Bio</TableHead>
            <TableHead>Seguidores</TableHead>
            <TableHead>Conta Business</TableHead>
            <TableHead>Comentário</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.slice(0, 200).map((lead, i) => (
            <TableRow key={`${lead.instagram_id || lead.username || i}-${i}`}>
              <TableCell className="max-w-[160px] truncate font-medium">{lead.nome || "—"}</TableCell>
              <TableCell>{lead.instagram_id || "—"}</TableCell>
              <TableCell className="max-w-[160px] truncate">{lead.nome_completo || "—"}</TableCell>
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
              <TableCell className="max-w-[240px] truncate">{lead.bio || "—"}</TableCell>
              <TableCell className="tabular-nums">{lead.followers_count !== "" ? lead.followers_count : "—"}</TableCell>
              <TableCell>
                {lead.is_business ? <BadgeCheck className="h-4 w-4 text-primary" /> : "—"}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{lead.comentario || "—"}</TableCell>
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
