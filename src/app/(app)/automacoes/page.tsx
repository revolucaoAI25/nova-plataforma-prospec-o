import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listarAutomacoesUsuario } from "@/lib/automation-db";
import { listarCampanhas } from "@/lib/dispatch-db";
import { AutomationsPanel } from "@/components/automations/automations-panel";

export const metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [automacoes, campanhas] = await Promise.all([
    listarAutomacoesUsuario(supabase, user.id),
    listarCampanhas(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Automações</h1>
        <p className="text-muted-foreground">
          Buscas programadas (CNPJ ou Google Maps) com exportação automática para Google Sheets e,
          opcionalmente, inscrição automática numa campanha de disparo.
        </p>
      </div>
      <AutomationsPanel automacoesIniciais={automacoes} campanhas={campanhas} />
    </div>
  );
}
