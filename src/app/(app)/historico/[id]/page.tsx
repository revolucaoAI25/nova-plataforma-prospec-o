import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarLeadsDaPesquisa } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadsTable } from "@/components/historico/leads-table";

export default async function HistoricoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: search } = await supabase.from("searches").select("*").eq("id", id).single();
  if (!search) notFound();

  const leads = await buscarLeadsDaPesquisa(supabase, id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/historico">
            <ArrowLeft className="h-4 w-4" /> Voltar ao histórico
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{search.nicho || "Pesquisa"}</h1>
          <Badge variant="outline">{search.fonte === "cnpj" ? "CNPJ" : "Google Maps"}</Badge>
        </div>
        <p className="text-muted-foreground">
          {search.localidade} · {new Date(search.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{leads.length} leads</CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/export/${id}?formato=xlsx`}>
                <Download className="h-4 w-4" /> Excel
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/export/${id}?formato=csv`}>
                <Download className="h-4 w-4" /> CSV
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <LeadsTable leads={leads} />
        </CardContent>
      </Card>
    </div>
  );
}
