import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/credits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Funil da página de vendas" };

interface Painel {
  etapas: Record<string, number>;
  secoes: Record<string, number>;
  cliques: { alvo: string; total: number; visitantes: number }[];
  origens: { fonte: string; campanha: string; anuncio: string; visitantes: number; checkouts: number; testes: number; contas: number; compras: number }[];
  dias: { dia: string; visitantes: number; testes: number; contas: number; compras: number }[];
  dispositivos: Record<string, number>;
  campanhas: string[];
}

// Ordem das seções na página de vendas (mesmos nomes de data-secao em /conheca).
const SECOES: [string, string][] = [
  ["inicio", "Início (hero)"],
  ["sem_trafego", "Sem tráfego pago"],
  ["chamada_1", "Chamada: ver planos / testar"],
  ["como_funciona", "Como funciona"],
  ["enriquecimento", "Enriquecimento do lead"],
  ["chamada_2", "Chamada: simular resultado"],
  ["calculadora", "Calculadora"],
  ["semana", "Uma semana na prática"],
  ["chamada_3", "Chamada: começar agora"],
  ["recursos", "Recursos"],
  ["comparativo", "Comparativo"],
  ["clientes", "Clientes"],
  ["planos", "Planos"],
  ["duvidas", "Dúvidas"],
  ["chamada_final", "Chamada final"],
  ["rodape", "Rodapé"],
];

const PERIODOS = [
  ["1", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["90", "90 dias"],
] as const;

const fmt = (n: number) => n.toLocaleString("pt-BR");
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");

function Barra({ rotulo, valor, base, anterior, destaque }: { rotulo: string; valor: number; base: number; anterior?: number; destaque?: boolean }) {
  const largura = base > 0 ? Math.max(valor > 0 ? 1.5 : 0, (valor / base) * 100) : 0;
  const dica = `${rotulo}: ${fmt(valor)} visitantes (${pct(valor, base)} do total${anterior !== undefined ? `, ${pct(valor, anterior)} da etapa anterior` : ""})`;
  return (
    <div className="flex flex-col gap-1.5" title={dica}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-foreground">{rotulo}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{fmt(valor)}</span>
          {anterior !== undefined ? (
            <span className="ml-2 text-xs">{pct(valor, anterior)} da etapa anterior</span>
          ) : valor !== base ? (
            <span className="ml-2 text-xs">{pct(valor, base)} dos visitantes</span>
          ) : null}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", destaque ? "bg-primary" : "bg-primary/60")} style={{ width: `${largura}%` }} />
      </div>
    </div>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</span>
        <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{valor}</span>
        {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
      </CardContent>
    </Card>
  );
}

export default async function FunilLpPage({ searchParams }: { searchParams: Promise<{ dias?: string; campanha?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/");

  const { dias: diasParam, campanha: campanhaParam } = await searchParams;
  const dias = PERIODOS.some(([v]) => v === diasParam) ? Number(diasParam) : 7;
  const campanha = campanhaParam?.trim() || null;
  const fim = new Date();
  const inicio = new Date(fim);
  if (dias === 1) inicio.setHours(inicio.getHours() - 24);
  else inicio.setDate(inicio.getDate() - dias);

  const { data, error } = await createAdminClient().rpc("lp_painel", {
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
    p_campanha: campanha,
  });
  const painel = (data as Painel | null) ?? null;
  const e = painel?.etapas ?? {};
  const v = (k: string) => Number(e[k] ?? 0);
  const visitantes = v("visitou");
  const pagos = v("comprou");
  const totalDispositivos = Object.values(painel?.dispositivos ?? {}).reduce((a, b) => a + Number(b), 0);

  const link = (params: { dias?: number; campanha?: string | null }) => {
    const q = new URLSearchParams();
    q.set("dias", String(params.dias ?? dias));
    const c = params.campanha === undefined ? campanha : params.campanha;
    if (c) q.set("campanha", c);
    return `/admin/funil-lp?${q.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1" role="group" aria-label="Período">
          {PERIODOS.map(([valor, rotulo]) => (
            <Link
              key={valor}
              href={link({ dias: Number(valor) })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                String(dias) === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {rotulo}
            </Link>
          ))}
        </div>
        <form method="get" action="/admin/funil-lp" className="flex items-center gap-2">
          <input type="hidden" name="dias" value={dias} />
          <select
            name="campanha"
            defaultValue={campanha ?? ""}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            aria-label="Campanha"
          >
            <option value="">Todas as campanhas</option>
            {(painel?.campanhas ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">Filtrar</button>
        </form>
      </div>

      {error && (
        <Alert>
          <AlertDescription>
            O painel ainda não tem onde ler os dados. Rode a migration <code>supabase/migrations/0046_rastreamento_teste_tour.sql</code> no
            SQL Editor do Supabase; a partir daí cada visita começa a ser registrada.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Numero rotulo="Visitantes" valor={fmt(visitantes)} detalhe={totalDispositivos ? `${pct(Number(painel?.dispositivos?.celular ?? 0), totalDispositivos)} no celular` : undefined} />
        <Numero rotulo="Testes grátis" valor={fmt(v("iniciou_teste"))} detalhe={`${pct(v("iniciou_teste"), visitantes)} dos visitantes`} />
        <Numero rotulo="Contas na contratação" valor={fmt(v("criou_conta"))} detalhe={`${pct(v("criou_conta"), visitantes)} dos visitantes`} />
        <Numero rotulo="Compras" valor={fmt(pagos)} detalhe={`${pct(pagos, visitantes)} dos visitantes · ${pct(pagos, v("criou_conta"))} das contas`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Caminho até a compra</CardTitle>
            <CardDescription>Visitantes únicos em cada etapa. A largura é relativa a quem visitou a página.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Barra rotulo="Visitaram a página" valor={visitantes} base={visitantes} destaque />
            <Barra rotulo="Chegaram aos planos" valor={v("viu_planos")} base={visitantes} anterior={visitantes} />
            <Barra rotulo="Clicaram em assinar" valor={v("clicou_assinar")} base={visitantes} anterior={v("viu_planos")} />
            <Barra rotulo="Abriram a contratação" valor={v("abriu_checkout")} base={visitantes} anterior={v("clicou_assinar")} />
            <Barra rotulo="Criaram a conta" valor={v("criou_conta")} base={visitantes} anterior={v("abriu_checkout")} />
            <Barra rotulo="Pagaram" valor={pagos} base={visitantes} anterior={v("criou_conta")} destaque />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Caminho do teste grátis e contato</CardTitle>
            <CardDescription>Quem preferiu testar antes ou falar com a equipe.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Barra rotulo="Clicaram em testar grátis" valor={v("clicou_teste")} base={visitantes} />
            <Barra rotulo="Abriram o cadastro do teste" valor={v("abriu_teste")} base={visitantes} anterior={v("clicou_teste")} />
            <Barra rotulo="Começaram o teste" valor={v("iniciou_teste")} base={visitantes} anterior={v("abriu_teste")} destaque />
            <Barra rotulo="Clicaram no WhatsApp" valor={v("clicou_whatsapp")} base={visitantes} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Até onde os visitantes rolam</CardTitle>
          <CardDescription>Parte dos visitantes que viu cada seção, na ordem da página. Onde a barra cai, a página está perdendo gente.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          {SECOES.map(([chave, nome]) => (
            <Barra key={chave} rotulo={nome} valor={Number(painel?.secoes?.[chave] ?? 0)} base={visitantes} />
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliques</CardTitle>
            <CardDescription>Botão (destino) e a seção em que estava, por visitantes únicos.</CardDescription>
          </CardHeader>
          <CardContent>
            {painel?.cliques?.length ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Botão · seção</TableHead><TableHead className="text-right">Visitantes</TableHead><TableHead className="text-right">Cliques</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {painel.cliques.map((c) => (
                    <TableRow key={c.alvo}>
                      <TableCell className="font-mono text-xs">{c.alvo}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(c.visitantes)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(c.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum clique no período.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por dia</CardTitle>
            <CardDescription>Horário de Brasília.</CardDescription>
          </CardHeader>
          <CardContent>
            {painel?.dias?.length ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Dia</TableHead><TableHead className="text-right">Visitantes</TableHead><TableHead className="text-right">Testes</TableHead><TableHead className="text-right">Contas</TableHead><TableHead className="text-right">Compras</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {[...painel.dias].reverse().map((d) => (
                    <TableRow key={d.dia}>
                      <TableCell className="tabular-nums">{d.dia.split("-").reverse().join("/")}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(d.visitantes)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(d.testes)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(d.contas)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(d.compras)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma visita no período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Origem: campanha e anúncio</CardTitle>
          <CardDescription>
            Pelos parâmetros utm_source, utm_campaign e utm_content do link do anúncio. Clique numa campanha para filtrar o painel inteiro por ela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {painel?.origens?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fonte</TableHead><TableHead>Campanha</TableHead><TableHead>Anúncio</TableHead>
                  <TableHead className="text-right">Visitantes</TableHead><TableHead className="text-right">Contratação</TableHead>
                  <TableHead className="text-right">Testes</TableHead><TableHead className="text-right">Contas</TableHead><TableHead className="text-right">Compras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {painel.origens.map((o, i) => (
                  <TableRow key={`${o.fonte}-${o.campanha}-${o.anuncio}-${i}`}>
                    <TableCell>{o.fonte}</TableCell>
                    <TableCell>
                      {o.campanha === "(sem campanha)" ? (
                        <span className="text-muted-foreground">{o.campanha}</span>
                      ) : (
                        <Link href={link({ campanha: o.campanha })} className="text-primary underline-offset-4 hover:underline">{o.campanha}</Link>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground" title={o.anuncio}>{o.anuncio || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(o.visitantes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(o.checkouts)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(o.testes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(o.contas)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(o.compras)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Sem visitas no período.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
