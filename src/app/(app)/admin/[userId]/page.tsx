import { redirect, notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { creditosContaTeste } from "@/lib/conta-teste";
import { brl, receitaMensalCentavos, situacaoCliente } from "@/lib/admin-clientes";
import { normalizarE164 } from "@/lib/phone";
import type { PlanRow } from "@/lib/database.types";
import { ContaTesteForm } from "@/components/admin/conta-teste-form";
import { CondicaoPrecoForm } from "@/components/admin/condicao-preco-form";
import { RecursosClienteForm } from "@/components/admin/recursos-cliente-form";
import { SituacaoBadge } from "@/components/admin/situacao-badge";
import { DadosClienteForm } from "@/components/perfil/dados-cliente-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Conta do cliente" };

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const me = await getProfile(supabase, user.id);
  if (!me || me.role !== "admin") redirect("/");

  const target = await getProfile(supabase, userId);
  if (!target) notFound();

  const [{ data: planosData }, { data: pacotesData }, creditosTeste] = await Promise.all([
    supabase.from("plans").select("*"),
    supabase.from("credit_packages").select("id, nome"),
    creditosContaTeste(),
  ]);
  const planos = new Map(((planosData ?? []) as PlanRow[]).map((p) => [p.id, p]));
  const plano = target.plano_id ? planos.get(target.plano_id) : undefined;
  const situacao = situacaoCliente(target, plano?.nome);
  const receita = receitaMensalCentavos(target, planos);
  const whatsapp = target.telefone ? normalizarE164(target.telefone) : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/admin/clientes"
        backLabel="Clientes"
        title={target.nome || target.email}
        badge={<SituacaoBadge situacao={situacao} />}
        description={
          [
            target.empresa,
            target.email,
            receita ? `${brl(receita)}/mês (${target.assinatura_ciclo === "anual" ? "anual" : "mensal"})` : null,
          ].filter(Boolean).join(" · ")
        }
        actions={
          whatsapp ? (
            <Button asChild variant="outline" size="sm">
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          ) : undefined
        }
      />
      <RecursosClienteForm
        userId={userId}
        isSelf={userId === user.id}
        contaTeste={target.conta_teste}
        inicial={{
          role: target.role,
          creditos: target.creditos,
          monthly_creditos: target.monthly_creditos,
          instagram_visible: target.instagram_visible,
          linkedin_visible: target.linkedin_visible,
          disparo_habilitado: target.disparo_habilitado,
          email_disparo_habilitado: target.email_disparo_habilitado,
          linkedin_disparo_habilitado: target.linkedin_disparo_habilitado,
          enriquecimento_ia_habilitado: target.enriquecimento_ia_habilitado,
          bigdatacorp_enrichment_habilitado: target.bigdatacorp_enrichment_habilitado,
          whatsapp_oficial_habilitado: Boolean(target.whatsapp_oficial_habilitado),
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do cliente</CardTitle>
          <CardDescription>O cliente também pode corrigir esses dados em Meu perfil.</CardDescription>
        </CardHeader>
        <CardContent>
          <DadosClienteForm
            inicial={{ nome: target.nome, telefone: target.telefone, empresa: target.empresa }}
            endpoint={`/api/admin/users/${userId}`}
            idPrefixo="admin-dados"
          />
        </CardContent>
      </Card>
      <CondicaoPrecoForm
        userId={userId}
        inicial={target.condicao_preco ?? null}
        nomesPlanos={Object.fromEntries([...planos.values()].map((p) => [p.id, p.nome]))}
        nomesPacotes={Object.fromEntries((pacotesData ?? []).map((p) => [p.id, p.nome]))}
      />
      <ContaTesteForm userId={userId} profile={target} creditosTeste={creditosTeste} />
    </div>
  );
}
