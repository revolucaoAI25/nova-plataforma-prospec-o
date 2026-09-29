import Link from "next/link";
import { Kanban, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarFunis } from "@/lib/funil-db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CriarFunilForm } from "@/components/funil/criar-funil-form";

export const metadata = { title: "Funil" };

export default async function FunilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const funis = user ? await listarFunis(supabase, user.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção"
        title="Funil"
        description="Acompanhe o contato com seus leads em colunas — arraste um card entre colunas pra disparar uma automação."
      />
      <CriarFunilForm />

      {funis.length === 0 ? (
        <EmptyState
          icon={Kanban}
          title="Nenhum funil criado ainda"
          description="Crie um funil pra organizar o contato com os leads que você já extraiu, em colunas que você define."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funis.map((f) => (
            <Link key={f.id} href={`/funil/${f.id}`} className="group rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <Card interactive className="h-full">
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                      <Kanban className="h-5 w-5" />
                    </div>
                    <CardTitle>{f.nome}</CardTitle>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
