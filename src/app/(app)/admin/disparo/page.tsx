import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarSolicitacoesOficial } from "@/lib/dispatch-db";
import { AdminOficialRequests } from "@/components/dispatch/admin-oficial-requests";

export const metadata = { title: "Disparo — canal oficial" };

export default async function AdminDisparoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/");

  const solicitacoes = await listarSolicitacoesOficial(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Disparo — canal oficial</h1>
        <p className="text-muted-foreground">Solicitações de conexão e provisionamento manual de instâncias oficiais.</p>
      </div>
      <AdminOficialRequests solicitacoesIniciais={solicitacoes} />
    </div>
  );
}
