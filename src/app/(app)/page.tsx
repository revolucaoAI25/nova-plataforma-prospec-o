import Link from "next/link";
import { Building2, MapPin, AtSign, History, ArrowRight, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarPesquisas, contarPesquisasELeads } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";

const FONTE_LABEL: Record<string, string> = { cnpj: "CNPJ", google_maps: "Google Maps", instagram: "Instagram" };
const FONTE_ICON: Record<string, typeof Building2> = { cnpj: Building2, google_maps: MapPin, instagram: AtSign };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id) : null;
  const [pesquisas, { totalPesquisas, totalLeads }] = await Promise.all([
    listarPesquisas(supabase, 5),
    contarPesquisasELeads(supabase),
  ]);

  return (
    <div className="relative isolate flex flex-col gap-8">
      <div
        className="bg-glow pointer-events-none absolute -top-24 left-1/4 -z-10 h-72 w-72 opacity-40"
        aria-hidden="true"
      />
      <Reveal>
        <PageHeader
          eyebrow="Painel"
          title="Visão geral"
          description={`Bem-vindo(a)${profile ? `, ${profile.email}` : ""}. Extraia leads por CNPJ, Google Maps ou Instagram.`}
        />
      </Reveal>

      <Reveal delay={60} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Créditos CNPJ" value={profile?.cdd_credits ?? 0} icon={Building2} tone="primary" />
        <StatCard
          label="Créditos Maps"
          value={profile?.maps_credits_enabled ? profile.maps_credits : "Ilimitado"}
          icon={MapPin}
          tone="info"
        />
        <StatCard label="Pesquisas realizadas" value={totalPesquisas} icon={Search} tone="violet" />
        <StatCard label="Leads coletados" value={totalLeads} icon={Users} tone="amber" />
      </Reveal>

      <Reveal delay={120} className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/busca/cnpj"
          className="group rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Card interactive className="h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <CardTitle>Busca por CNPJ</CardTitle>
              </div>
              <CardDescription>
                Empresas ativas na Receita Federal, filtradas por CNAE, UF, porte, data de
                abertura e mais — via Casa dos Dados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Saldo: <strong className="text-foreground">{profile?.cdd_credits ?? 0}</strong> créditos
                </span>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link
          href="/busca/maps"
          className="group rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Card interactive className="h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
                  <MapPin className="h-5 w-5" />
                </div>
                <CardTitle>Busca por Google Maps</CardTitle>
              </div>
              <CardDescription>
                Estabelecimentos por nicho e localidade, com telefone, site e avaliação —
                via Google Places.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {profile?.maps_credits_enabled ? (
                    <>Saldo: <strong className="text-foreground">{profile.maps_credits}</strong> créditos</>
                  ) : (
                    "Sem cobrança de créditos"
                  )}
                </span>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </Reveal>

      <Reveal delay={180}>
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Últimas pesquisas
            </CardTitle>
            <Link href="/historico" className="text-sm font-medium text-primary hover:underline">
              Ver histórico completo
            </Link>
          </CardHeader>
          <CardContent>
            {pesquisas.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nenhuma pesquisa realizada ainda"
                description="Suas buscas por CNPJ, Google Maps e Instagram vão aparecer aqui."
                action={
                  <Link href="/busca/cnpj" className="text-sm font-medium text-primary hover:underline">
                    Começar uma busca
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {pesquisas.map((p) => {
                  const Icon = FONTE_ICON[p.fonte] ?? Building2;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <Link href={`/historico/${p.id}`} className="truncate font-medium hover:underline">
                            {p.nicho || p.localidade || "Pesquisa"}
                          </Link>
                          <p className="truncate text-muted-foreground">
                            {p.localidade} · {new Date(p.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{p.total_results} leads</Badge>
                        <Badge variant="outline">{FONTE_LABEL[p.fonte] ?? p.fonte}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
