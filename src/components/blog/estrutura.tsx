import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIAS, type Categoria } from "@/lib/blog/artigos";
import { EMAIL_CONTATO } from "@/components/lp/dados";

/** Endereço da página do produto com a origem marcada (o funil da página separa quem veio do blog). */
export function linkProduto(campanha: string, destino: "/" | "/teste-gratis" = "/"): string {
  const q = new URLSearchParams({ utm_source: "blog", utm_medium: "artigo", utm_campaign: campanha });
  return `${destino}?${q.toString()}`;
}

export function CabecalhoBlog({ categoriaAtiva }: { categoriaAtiva?: Categoria }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/blog" className="flex min-h-11 items-center gap-2.5 text-foreground">
          <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
          <span className="font-lp-display text-lg font-bold tracking-tight">Leadmatic</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary-dark">Blog</span>
        </Link>
        <Link
          href={linkProduto("cabecalho")}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <span className="hidden sm:inline">Conheça o Leadmatic</span>
          <span className="sm:hidden">Conhecer</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <nav aria-label="Categorias do blog" className="border-t border-border">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
          <li>
            <Link
              href="/blog"
              aria-current={!categoriaAtiva ? "page" : undefined}
              className={`flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium ${!categoriaAtiva ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Todos os artigos
            </Link>
          </li>
          {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => (
            <li key={c}>
              <Link
                href={`/blog/categoria/${c}`}
                aria-current={categoriaAtiva === c ? "page" : undefined}
                className={`flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium ${categoriaAtiva === c ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {CATEGORIAS[c].nome}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function RodapeBlog() {
  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link href="/blog" className="flex items-center gap-2.5 text-foreground">
            <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
            <span className="font-lp-display text-lg font-bold tracking-tight">Blog do Leadmatic</span>
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Guias práticos sobre prospecção ativa, geração de clientes B2B e vendas, escritos por quem prospecta todos os dias.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Categorias</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => (
              <li key={c}>
                <Link href={`/blog/categoria/${c}`} className="hover:text-foreground">{CATEGORIAS[c].nome}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Leadmatic</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            <li><Link href={linkProduto("rodape")} className="hover:text-foreground">Conheça a plataforma</Link></li>
            <li><Link href="/blog/rss.xml" className="hover:text-foreground">RSS do blog</Link></li>
            <li><Link href="/privacidade" className="hover:text-foreground">Privacidade</Link></li>
            <li><Link href="/termos" className="hover:text-foreground">Termos de uso</Link></li>
            <li><a href={`mailto:${EMAIL_CONTATO}`} className="hover:text-foreground">{EMAIL_CONTATO}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Leadmatic · Revolução AI
        </p>
      </div>
    </footer>
  );
}

/** Chamada para o produto: no meio do artigo (`:::cta`) e no fim. */
export function ChamadaProduto({ campanha, variante = "meio" }: { campanha: string; variante?: "meio" | "fim" }) {
  return (
    <aside
      aria-label="Sobre o Leadmatic"
      className="not-prose my-10 overflow-hidden rounded-2xl border border-border bg-[radial-gradient(120%_120%_at_0%_0%,var(--accent-soft),transparent_60%)] bg-card p-6 sm:p-8"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-dark">Leadmatic</p>
      <p className="mt-2 font-lp-display text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
        {variante === "fim" ? "Coloque esse método para rodar sem fazer tudo à mão" : "Encontre as empresas certas e aborde quem decide, no automático"}
      </p>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        O Leadmatic busca empresas por CNPJ, Google Maps, Instagram e LinkedIn, encontra o sócio e o contato de quem decide e conduz a abordagem
        por WhatsApp, e-mail e LinkedIn, avisando quando alguém responde.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={linkProduto(campanha)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark hover:text-white"
        >
          Ver como funciona <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href={linkProduto(campanha, "/teste-gratis")}
          className="inline-flex h-11 items-center rounded-full border border-border-strong px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Testar grátis
        </Link>
      </div>
    </aside>
  );
}
