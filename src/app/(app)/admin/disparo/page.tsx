import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarSolicitacoesOficial } from "@/lib/dispatch-db";
import { AdminOficialRequests } from "@/components/dispatch/admin-oficial-requests";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dadosWebhookOficial } from "@/lib/integrations/whatsapp-oficial";

export const metadata = { title: "Disparo — canal oficial" };

export default async function AdminDisparoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/");

  const [solicitacoes, webhook] = await Promise.all([listarSolicitacoesOficial(supabase), dadosWebhookOficial()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/admin"
        eyebrow="Administração"
        title="Canal oficial"
        description="Solicitações de conexão e provisionamento manual de instâncias oficiais."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook do canal oficial</CardTitle>
          <CardDescription>
            Cadastre no painel do provedor (ou no app da Meta, campo &quot;messages&quot;) pra receber entregue, lido e respostas. Um só pra todas as instâncias.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {webhook.url ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">URL de callback</span>
                <code className="break-all rounded-lg bg-secondary px-2.5 py-1.5 font-mono text-xs text-foreground">{webhook.url}</code>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Token de verificação (verify token)</span>
                <code className="break-all rounded-lg bg-secondary px-2.5 py-1.5 font-mono text-xs text-foreground">{webhook.token}</code>
              </div>
            </>
          ) : (
            <p className="text-amber">Defina NEXT_PUBLIC_APP_URL (endereço público da plataforma) e WEBHOOK_SECRET no ambiente pra gerar a URL.</p>
          )}
        </CardContent>
      </Card>
      <AdminOficialRequests solicitacoesIniciais={solicitacoes} />
    </div>
  );
}
