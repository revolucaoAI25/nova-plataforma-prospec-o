import { Coins, Crown, Gauge, Puzzle } from "lucide-react";
import type { AddonRow, CreditCostRow, CreditPackageRow, PlanRow } from "@/lib/database.types";
import { CreditCostsPanel } from "@/components/admin/credit-costs-panel";
import { CreditPackagesPanel } from "@/components/admin/credit-packages-panel";
import { PlansPanel } from "@/components/admin/plans-panel";
import { AddonsPanel } from "@/components/admin/addons-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { paginaSoAdmin } from "@/lib/admin-pagina";

export const metadata = { title: "Planos e preços" };

export default async function AdminPrecosPage() {
  const { supabase } = await paginaSoAdmin();
  const [{ data: planos }, { data: addons }, { data: pacotes }, { data: custos }] = await Promise.all([
    supabase.from("plans").select("*").order("ordem"),
    supabase.from("addons").select("*").order("ordem"),
    supabase.from("credit_packages").select("*").order("ordem"),
    supabase.from("credit_costs").select("*").order("acao"),
  ]);

  return (
    <Tabs defaultValue="planos">
      <TabsList>
        <TabsTrigger value="planos"><Crown className="h-3.5 w-3.5" /> Planos</TabsTrigger>
        <TabsTrigger value="addons"><Puzzle className="h-3.5 w-3.5" /> Add-ons</TabsTrigger>
        <TabsTrigger value="pacotes"><Coins className="h-3.5 w-3.5" /> Pacotes de créditos</TabsTrigger>
        <TabsTrigger value="custos"><Gauge className="h-3.5 w-3.5" /> Custo por ação</TabsTrigger>
      </TabsList>
      <TabsContent value="planos"><PlansPanel planosIniciais={(planos as PlanRow[]) ?? []} /></TabsContent>
      <TabsContent value="addons"><AddonsPanel addonsIniciais={(addons as AddonRow[]) ?? []} /></TabsContent>
      <TabsContent value="pacotes"><CreditPackagesPanel pacotesIniciais={(pacotes as CreditPackageRow[]) ?? []} /></TabsContent>
      <TabsContent value="custos"><CreditCostsPanel custos={(custos as CreditCostRow[]) ?? []} /></TabsContent>
    </Tabs>
  );
}
