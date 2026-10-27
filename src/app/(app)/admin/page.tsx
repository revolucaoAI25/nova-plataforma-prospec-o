import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanRow } from "@/lib/database.types";
import { brl, receitaMensalCentavos, situacaoCliente, type ClienteAdmin } from "@/lib/admin-clientes";
import { formatarExibicao, normalizarE164 } from "@/lib/phone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SituacaoBadge } from "@/components/admin/situacao-badge";
import { UsoBuscas } from "@/components/admin/uso-buscas";
import { paginaSoAdmin } from "@/lib/admin-pagina";

export const metadata = { title: "Administração" };

type Perfil = ClienteAdmin & { email: string; nome: string | null; empresa: string | null; telefone: string | null; created_at: string };

const DIA = 86_400_000;
const fmt = (n: number) => n.toLocaleString("pt-BR");

function Numero({ rotulo, valor, detalhe, href }: { rotulo: string; valor: string; detalhe?: string; href?: string }) {
  const conteudo = (
    <CardContent className="flex h-full flex-col gap-1 p-5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{valor}</span>
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </CardContent>
  );
  return href ? (
    <Link href={href} className="rounded-2xl transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full">{conteudo}</Card>
    </Link>
  ) : (
    <Card>{conteudo}</Card>
  );
}

export default async function AdminPage() {
  await paginaSoAdmin();
  const admin = createAdminClient();
  const agora = new Date();
  const seteDias = new Date(agora);
  seteDias.setDate(seteDias.getDate() - 7);

  const [{ data: perfisData }, { data: planosData }, leads] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("plans").select("*"),
    admin.from("lp_leads").select("coluna").gte("criado_em", seteDias.toISOString()).limit(5000),
  ]);
  const perfis = (perfisData ?? []) as Perfil[];
  const planos = new Map(((planosData ?? []) as PlanRow[]).map((p) => [p.id, p]));
  const comSituacao = perfis.map((p) => ({ ...p, situacao: situacaoCliente(p, p.plano_id ? planos.get(p.plano_id)?.nome : null, agora) }));
  const clientes = comSituacao.filter((p) => p.situacao.filtro !== "interno");

  const assinantes = clientes.filter((p) => p.situacao.filtro === "assinante");
  const receita = assinantes.reduce((soma, p) => soma + receitaMensalCentavos(p, planos), 0);
  const emTeste = clientes.filter((p) => p.teste_gratis && p.assinatura_status !== "ativa" && (!p.teste_expira_em || new Date(p.teste_expira_em) > agora));
  const testeAcabando = emTeste.filter((p) => p.teste_expira_em && new Date(p.teste_expira_em).getTime() - agora.getTime() <= 2 * DIA);
  const novos = clientes.filter((p) => new Date(p.created_at) >= seteDias);
  const leadsNovos = leads.error ? null : (leads.data ?? []);

  // Quem vale um contato agora: pagamento parado, teste terminando ou recém-terminado sem assinar.
  const prioridade = (p: (typeof clientes)[number]) => {
    if (p.assinatura_status === "inadimplente") return 0;
    if (p.assinatura_status === "pendente") return 1;
    if (testeAcabando.includes(p)) return 2;
    const fim = p.teste_expira_em ? new Date(p.teste_expira_em).getTime() : 0;
    if (p.teste_gratis && p.assinatura_status !== "ativa" && fim <= agora.getTime() && agora.getTime() - fim <= 7 * DIA) return 3;
    if (p.situacao.filtro === "atencao") return 4;
    return -1;
  };
  const atencao = clientes
    .map((p) => ({ p, ordem: prioridade(p) }))
    .filter((x) => x.ordem >= 0)
    .sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Numero
          rotulo="Assinantes"
          valor={fmt(assinantes.length)}
          detalhe={`${brl(receita)} por mês em assinaturas`}
          href="/admin/clientes?situacao=assinante"
        />
        <Numero
          rotulo="Em teste grátis"
          valor={fmt(emTeste.length)}
          detalhe={testeAcabando.length ? `${fmt(testeAcabando.length)} terminam em até 2 dias` : "Nenhum terminando nos próximos 2 dias"}
          href="/admin/clientes?situacao=teste"
        />
        <Numero
          rotulo="Novas contas · 7 dias"
          valor={fmt(novos.length)}
          detalhe={`${fmt(clientes.length)} contas no total`}
          href="/admin/clientes"
        />
        <Numero
          rotulo="Leads da página · 7 dias"
          valor={leadsNovos ? fmt(leadsNovos.length) : "—"}
          detalhe={
            leadsNovos
              ? `${fmt(leadsNovos.filter((l) => l.coluna === "preencheu").length)} preencheram e não concluíram`
              : "Rode a migration 0049 para ver os leads"
          }
          href="/admin/leads"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Vale um contato agora</CardTitle>
              <CardDescription>Pagamento parado, teste terminando ou que terminou sem assinatura. Bons para um contato.</CardDescription>
            </div>
            {atencao.length > 0 && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{atencao.length}</span>
            )}
          </CardHeader>
          <CardContent>
            {atencao.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguém precisando de contato agora.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {atencao.slice(0, 10).map(({ p }) => {
                  const whatsapp = p.telefone ? normalizarE164(p.telefone) : "";
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3 first:pt-0 last:pb-0">
                      <Link href={`/admin/${p.id}`} className="min-w-0 flex-1 basis-48 hover:underline">
                        <p className="truncate text-sm font-medium text-foreground">{p.nome || p.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[p.empresa, p.telefone ? formatarExibicao(p.telefone) : p.email].filter(Boolean).join(" · ")}
                        </p>
                      </Link>
                      <SituacaoBadge situacao={p.situacao} />
                      {whatsapp && (
                        <Button asChild size="sm" variant="ghost" className="h-8 px-2" title="Abrir conversa no WhatsApp">
                          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${p.nome || p.email}`}>
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {atencao.length > 10 && (
              <Button asChild variant="ghost" size="sm" className="mt-3 -ml-3">
                <Link href="/admin/clientes">
                  Ver todos os clientes <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Suspense fallback={null}>
            <UsoBuscas />
          </Suspense>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assinantes por plano</CardTitle>
            </CardHeader>
            <CardContent>
              {assinantes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum assinante ainda.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {[...planos.values()]
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((plano) => ({ plano, total: assinantes.filter((p) => p.plano_id === plano.id).length }))
                    .filter((x) => x.total > 0)
                    .map(({ plano, total }) => (
                      <li key={plano.id} className="flex items-center justify-between gap-3">
                        <span className="text-foreground">{plano.nome}</span>
                        <span className="font-semibold tabular-nums text-foreground">{fmt(total)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
