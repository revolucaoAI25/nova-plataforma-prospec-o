import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleDashed, ArrowRight, MessageCircle, Mail, Contact, Sheet as SheetIcon, BrainCircuit, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { statusConexoes, type ConexaoId } from "@/lib/conexoes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SheetsSettings } from "@/components/settings/sheets-settings";
import { OpenAiSettings } from "@/components/settings/openai-settings";
import { PageHeader } from "@/components/layout/page-header";
import { oauthDisponivel } from "@/lib/integrations/google-sheets";

export const metadata = { title: "Conexões" };

const ICONES: Record<ConexaoId, LucideIcon> = {
  whatsapp: MessageCircle,
  email: Mail,
  linkedin: Contact,
  sheets: SheetIcon,
  openai: BrainCircuit,
};

export default async function ConexoesPage({ searchParams }: { searchParams: Promise<{ sheets?: string }> }) {
  const { sheets } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile) redirect("/login");

  const [conexoes, sheetsOauthConfigurado] = await Promise.all([statusConexoes(supabase, profile), oauthDisponivel()]);
  const disponiveis = conexoes.filter((c) => c.disponivel);
  const openaiDisponivel = disponiveis.some((c) => c.id === "openai");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Conta"
        title="Conexões"
        description="Tudo que a plataforma usa em seu nome, num lugar só. As fontes de dados (CNPJ, Maps, Instagram, LinkedIn) já vêm prontas — aqui você só conecta os seus canais."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {disponiveis.map((c) => {
          const Icone = ICONES[c.id];
          return (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icone className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{c.label}</CardTitle>
                    <CardDescription className="text-xs">{c.descricao}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-2">
                <Badge variant={c.conectado ? "success" : "outline"} className="gap-1">
                  {c.conectado ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
                  {c.detalhe}
                </Badge>
                <Button asChild size="sm" variant={c.conectado ? "ghost" : "default"}>
                  <Link href={c.href}>
                    {c.conectado ? "Gerenciar" : "Conectar"} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section id="sheets" className="flex scroll-mt-24 flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Google Sheets</h2>
        <SheetsSettings profile={profile} initialFeedback={sheets} oauthConfigured={sheetsOauthConfigurado} />
      </section>

      {openaiDisponivel && (
        <section id="openai" className="flex scroll-mt-24 flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">OpenAI</h2>
          <OpenAiSettings profile={profile} />
        </section>
      )}
    </div>
  );
}
