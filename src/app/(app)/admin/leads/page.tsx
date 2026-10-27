import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LeadsBoard } from "@/components/admin/leads-board";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/lib/lp-leads-tipos";

export const metadata = { title: "Leads da página" };

const PERIODOS: [string, string][] = [["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["todos", "Tudo"]];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/");

  const { dias: diasParam } = await searchParams;
  const dias = PERIODOS.some(([v]) => v === diasParam) ? diasParam! : "30";

  let consulta = createAdminClient().from("lp_leads").select("*").order("atualizado_em", { ascending: false }).limit(2000);
  if (dias !== "todos") {
    const desde = new Date();
    desde.setDate(desde.getDate() - Number(dias));
    consulta = consulta.gte("atualizado_em", desde.toISOString());
  }
  const { data, error } = await consulta;

  return (
    <div className="flex flex-col gap-6">
      <div className="inline-flex self-start rounded-lg border border-border bg-card p-1" role="group" aria-label="Período">
        {PERIODOS.map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={`/admin/leads?dias=${valor}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              valor === dias ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {rotulo}
          </Link>
        ))}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>Não foi possível carregar os leads. Rode a migration 0049 no Supabase (SQL Editor).</AlertDescription>
        </Alert>
      ) : (
        <LeadsBoard leadsIniciais={(data ?? []) as LeadRow[]} />
      )}
    </div>
  );
}
