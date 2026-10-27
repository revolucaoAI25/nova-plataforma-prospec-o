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
  ["calculadora", "Calculadora"],
  ["comparativo", "Comparativo"],
  ["clientes", "Clientes (prova social)"],
  ["planos", "Planos (oferta)"],
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

const BOTOES: Record<string, string> = {
  assinar: "Assinar",
  teste: "Testar grátis",
  whatsapp: "WhatsApp",
  entrar: "Entrar",
  ancora_planos: "Ver planos",
  ancora_conta: "Simular resultado",
  pagar: "Pagar",
  link: "Outro link",
};

/** "assinar:planos" → botão "Assinar", em "Planos (oferta)". */
function descreverClique(alvo: string): { botao: string; onde: string } {
  const [base, secao] = alvo.split(":");
  const nomeSecao = SECOES.find(([k]) => k === secao)?.[1] ?? (secao === "topo" ? "Menu do topo" : secao === "bem-vindo" ? "Página de boas-vindas" : secao || "—");
  const botao = BOTOES[base] ?? (base.startsWith("ancora_") ? `Ir para "${base.slice(7)}"` : base);
  return { botao, onde: nomeSecao };
}

/**
 * Passos de um funil, com a perda desde o passo anterior. Destaca a maior
 * perda em proporção (o passo que mais deixa gente para trás), não em
 * quantidade: no topo sempre sai mais gente em número absoluto.
 */
function Jornada({ passos, base }: { passos: { rotulo: string; valor: number }[]; base: number }) {
  const perdas = passos.map((p, i) => (i === 0 ? 0 : Math.max(0, passos[i - 1].valor - p.valor)));
  const taxas = perdas.map((perda, i) => (i > 0 && passos[i - 1].valor > 0 ? perda / passos[i - 1].valor : 0));
  const maior = Math.max(...taxas.slice(1), 0);
  return (
    <ol className="flex flex-col gap-3">
      {passos.map((p, i) => {
        const largura = base > 0 ? Math.max(p.valor > 0 ? 1.5 : 0, Math.min(100, (p.valor / base) * 100)) : 0;
        const destaque = maior > 0 && taxas[i] === maior;
        return (
          <li key={p.rotulo} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-2 text-foreground">
                <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <span className="truncate">{p.rotulo}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-foreground">{fmt(p.valor)}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">{pct(p.valor, base)}</span>
              </span>
            </div>
            <div className="ml-7 h-2.5 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full rounded-full", i === passos.length - 1 ? "bg-primary" : "bg-primary/60")} style={{ width: `${largura}%` }} />
            </div>
            {i > 0 && perdas[i] > 0 && (
              <span className={cn("ml-7 text-xs", destaque ? "font-semibold text-destructive" : "text-muted-foreground")}>
                {destaque ? "Maior perda: " : ""}−{fmt(perdas[i])} ({pct(perdas[i], passos[i - 1].valor)} de quem estava no passo anterior)
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Numero({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border p-4", destaque ? "border-primary/40 bg-accent/40" : "border-border bg-card")}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{valor}</span>
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </div>
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
  const sec = (k: string) => Number(painel?.secoes?.[k] ?? 0);
  const porCem = (n: number) => (visitantes ? Math.round((n / visitantes) * 100).toLocaleString("pt-BR") : "0");
  // Rolagem na ordem da página e o ponto em que mais gente sai.
  const rolagem = SECOES.map(([chave, nome]) => ({ chave, nome, valor: sec(chave) }));
  // Até a oferta (depois dos planos, sair é esperado): o trecho que perde a maior parte de quem chegou nele.
  const ateOferta = rolagem.slice(0, rolagem.findIndex((r) => r.chave === "planos") + 1);
  const maiorQueda = ateOferta.slice(1).reduce<{ chave: string; nome: string; perda: number; taxa: number; pct: string } | null>((maior, r, i) => {
    const antes = ateOferta[i].valor;
    const perda = antes - r.valor;
    const taxa = antes > 0 ? perda / antes : 0;
    if (perda <= 0 || (maior && maior.taxa >= taxa)) return maior;
    return { chave: r.chave, nome: r.nome, perda, taxa, pct: pct(perda, antes) };
  }, null);

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

      {/* Resumo em linguagem de gente: de cada 100 visitantes, quantos chegam a cada ponto. */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <p className="text-sm text-muted-foreground">
            {visitantes ? (
              <>
                De cada <strong className="text-foreground">100 visitantes</strong>,{" "}
                <strong className="text-foreground">{porCem(v("viu_planos"))}</strong> chegam na oferta (planos),{" "}
                <strong className="text-foreground">{porCem(v("clicou_assinar"))}</strong> clicam para assinar,{" "}
                <strong className="text-foreground">{porCem(v("iniciou_teste"))}</strong> começam o teste grátis e{" "}
                <strong className="text-foreground">{porCem(pagos)}</strong> pagam.
              </>
            ) : (
              "Nenhuma visita no período."
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Numero rotulo="Visitantes" valor={fmt(visitantes)} detalhe={totalDispositivos ? `${pct(Number(painel?.dispositivos?.celular ?? 0), totalDispositivos)} no celular` : undefined} />
            <Numero rotulo="Chegaram na oferta" valor={fmt(v("viu_planos"))} detalhe={`${pct(v("viu_planos"), visitantes)} dos visitantes`} />
            <Numero rotulo="Clicaram em assinar" valor={fmt(v("clicou_assinar"))} detalhe={`${pct(v("clicou_assinar"), visitantes)} dos visitantes`} />
            <Numero rotulo="Testes grátis" valor={fmt(v("iniciou_teste"))} detalhe={`${pct(v("iniciou_teste"), visitantes)} dos visitantes`} />
            <Numero rotulo="Compras" valor={fmt(pagos)} detalhe={`${pct(pagos, visitantes)} dos visitantes`} destaque />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jornada até a compra</CardTitle>
            <CardDescription>
              Pessoas diferentes que chegaram a cada ponto, na ordem. Ao lado, quantas se perderam desde o passo anterior; a maior perda
              fica em destaque, é onde vale mexer primeiro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Jornada
              base={visitantes}
              passos={[
                { rotulo: "Entraram na página", valor: visitantes },
                { rotulo: "Passaram do topo", valor: sec("sem_trafego") },
                { rotulo: "Viram como funciona", valor: sec("como_funciona") },
                { rotulo: "Viram a calculadora", valor: sec("calculadora") },
                { rotulo: "Chegaram na oferta (planos)", valor: v("viu_planos") },
                { rotulo: "Clicaram em assinar", valor: v("clicou_assinar") },
                { rotulo: "Abriram a contratação", valor: v("abriu_checkout") },
                { rotulo: "Criaram a conta", valor: v("criou_conta") },
                { rotulo: "Pagaram", valor: pagos },
              ]}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teste grátis</CardTitle>
              <CardDescription>Quem preferiu testar antes de assinar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Jornada
                base={visitantes}
                passos={[
                  { rotulo: "Clicaram em testar grátis", valor: v("clicou_teste") },
                  { rotulo: "Abriram o cadastro", valor: v("abriu_teste") },
                  { rotulo: "Começaram o teste", valor: v("iniciou_teste") },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contato</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <strong className="text-2xl font-bold tabular-nums text-foreground">{fmt(v("clicou_whatsapp"))}</strong> pessoas clicaram no WhatsApp ({pct(v("clicou_whatsapp"), visitantes)} dos visitantes).
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Até onde as pessoas rolam a página</CardTitle>
          <CardDescription>
            Parte dos visitantes que viu cada seção, na ordem da página.{maiorQueda ? ` Até a oferta, o trecho que mais perde gente é logo antes de "${maiorQueda.nome}": ${maiorQueda.pct} de quem chegou ali para de rolar (${fmt(maiorQueda.perda)} pessoas).` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {rolagem.map((r) => (
            <div key={r.chave} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5rem]">
              <span className={cn("truncate", r.chave === maiorQueda?.chave ? "font-semibold text-destructive" : "text-foreground")} title={r.nome}>{r.nome}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div className={cn("h-full rounded-full", r.chave === "planos" ? "bg-primary" : "bg-primary/60")} style={{ width: `${visitantes ? Math.max(r.valor ? 1.5 : 0, (r.valor / visitantes) * 100) : 0}%` }} />
              </div>
              <span className="text-right tabular-nums text-muted-foreground">{pct(r.valor, visitantes)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Em quais botões clicam</CardTitle>
            <CardDescription>Cada botão e a parte da página em que estava. Pessoas diferentes (e total de cliques).</CardDescription>
          </CardHeader>
          <CardContent>
            {painel?.cliques?.length ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Botão</TableHead><TableHead>Onde</TableHead><TableHead className="text-right">Pessoas</TableHead><TableHead className="text-right">Cliques</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {painel.cliques.map((c) => {
                    const { botao, onde } = descreverClique(c.alvo);
                    return (
                      <TableRow key={c.alvo}>
                        <TableCell className="font-medium">{botao}</TableCell>
                        <TableCell className="text-muted-foreground">{onde}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(c.visitantes)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(c.total)}</TableCell>
                      </TableRow>
                    );
                  })}
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
