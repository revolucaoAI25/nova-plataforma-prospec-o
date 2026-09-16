import Link from "next/link";
import { Building2, MapPin, History, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarPesquisas } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfile(supabase, user.id) : null;
  const pesquisas = await listarPesquisas(supabase, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Visão geral</h1>
        <p className="text-muted-foreground">
          Bem-vindo(a){profile ? `, ${profile.email}` : ""}. Extraia leads por CNPJ ou Google Maps.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Busca por CNPJ</CardTitle>
            </div>
            <CardDescription>
              Empresas ativas na Receita Federal, filtradas por CNAE, UF, porte, data de
              abertura e mais — via Casa dos Dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Saldo: <strong className="text-foreground">{profile?.cdd_credits ?? 0}</strong> créditos
              </span>
              <Button asChild size="sm">
                <Link href="/busca/cnpj">
                  Buscar <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle>Busca por Google Maps</CardTitle>
            </div>
            <CardDescription>
              Estabelecimentos por nicho e localidade, com telefone, site e avaliação —
              via Google Places.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {profile?.maps_credits_enabled
                  ? <>Saldo: <strong className="text-foreground">{profile.maps_credits}</strong> créditos</>
                  : "Sem cobrança de créditos"}
              </span>
              <Button asChild size="sm">
                <Link href="/busca/maps">
                  Buscar <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Últimas pesquisas
            </CardTitle>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/historico">Ver histórico completo</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pesquisas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pesquisa realizada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pesquisas.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <Link href={`/historico/${p.id}`} className="font-medium hover:underline">
                      {p.nicho || p.localidade || "Pesquisa"}
                    </Link>
                    <p className="text-muted-foreground">
                      {p.localidade} · {new Date(p.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{p.total_results} leads</Badge>
                    <Badge variant="outline">{p.fonte === "cnpj" ? "CNPJ" : "Google Maps"}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
