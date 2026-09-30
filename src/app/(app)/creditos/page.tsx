import { Coins, Crown, Package, Puzzle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarPacotesAtivos, listarComprasDoUsuario } from "@/lib/credit-purchases-db";
import { listarPlanosAtivos } from "@/lib/subscriptions-db";
import { listarAddonsAtivos, listarAssinaturasAddonsDoUsuario } from "@/lib/addons-db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MSG_CONTA_TESTE_SEM_COMPRA } from "@/lib/conta-teste";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PacotesGrid } from "@/components/creditos/pacotes-grid";
import { HistoricoCompras } from "@/components/creditos/historico-compras";
import { PlanosGrid } from "@/components/creditos/planos-grid";
import { AddonsGrid } from "@/components/creditos/addons-grid";
import { asaasConfigurado } from "@/lib/integrations/asaas";
import { redirect } from "next/navigation";

export const metadata = { title: "Créditos e planos" };

export default async function CreditosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile) redirect("/login");

  const [pacotes, compras, planos, addons, assinaturasAddons, configurado] = await Promise.all([
    listarPacotesAtivos(supabase),
    listarComprasDoUsuario(supabase, user.id),
    listarPlanosAtivos(supabase),
    listarAddonsAtivos(supabase),
    listarAssinaturasAddonsDoUsuario(supabase, user.id),
    asaasConfigurado(),
  ]);
  const podeComprar = configurado && !profile.conta_teste;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Conta"
        title="Créditos e planos"
        description="Assine um plano pra renovação mensal automática, ou compre créditos avulsos quando precisar — sem compromisso."
        badge={
          <Badge variant="secondary" className="gap-1.5">
            <Coins className="h-3.5 w-3.5 text-primary" /> Saldo atual: {profile.creditos}
          </Badge>
        }
      />

      {profile.conta_teste && (
        <Alert variant="info">
          <AlertDescription>{MSG_CONTA_TESTE_SEM_COMPRA}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="planos">
        <TabsList>
          <TabsTrigger value="planos"><Crown className="h-3.5 w-3.5" /> Planos</TabsTrigger>
          <TabsTrigger value="avulso"><Package className="h-3.5 w-3.5" /> Créditos avulsos</TabsTrigger>
          {addons.length > 0 && <TabsTrigger value="extras"><Puzzle className="h-3.5 w-3.5" /> Extras</TabsTrigger>}
        </TabsList>
        <TabsContent value="planos">
          <PlanosGrid
            planos={planos}
            planoAtualId={profile.plano_id}
            statusAtual={profile.assinatura_status}
            cicloAtual={profile.assinatura_ciclo}
            temCpfCnpj={Boolean(profile.cpf_cnpj)}
            configurado={podeComprar}
          />
        </TabsContent>
        <TabsContent value="avulso" className="flex flex-col gap-6">
          <PacotesGrid pacotes={pacotes} temCpfCnpj={Boolean(profile.cpf_cnpj)} configurado={podeComprar} />
          <HistoricoCompras comprasIniciais={compras} />
        </TabsContent>
        {addons.length > 0 && (
          <TabsContent value="extras">
            <AddonsGrid
              addons={addons}
              assinaturasIniciais={assinaturasAddons}
              temCpfCnpj={Boolean(profile.cpf_cnpj)}
              configurado={podeComprar}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
