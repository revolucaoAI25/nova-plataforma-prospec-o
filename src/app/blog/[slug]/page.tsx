import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoBlog, ChamadaProduto } from "@/components/blog/estrutura";
import { CartaoArtigo } from "@/components/blog/cartao-artigo";
import { buscarArtigo, CATEGORIAS, formatarData, listarArtigos, minutosDeLeitura, relacionados, renderizarArtigo } from "@/lib/blog/artigos";
import { ORGANIZACAO_JSONLD, SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return listarArtigos().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const artigo = buscarArtigo(slug);
  if (!artigo) return {};
  const url = `/blog/${artigo.slug}`;
  return {
    title: { absolute: artigo.titulo },
    description: artigo.descricao,
    keywords: artigo.palavrasChave,
    alternates: { canonical: url },
    authors: [{ name: "Equipe Leadmatic", url: SITE_URL }],
    openGraph: {
      title: artigo.titulo,
      description: artigo.descricao,
      type: "article",
      url,
      siteName: "Leadmatic",
      locale: "pt_BR",
      publishedTime: artigo.publicado,
      modifiedTime: artigo.atualizado,
      section: CATEGORIAS[artigo.categoria].nome,
      tags: artigo.palavrasChave,
    },
    twitter: { card: "summary_large_image", title: artigo.titulo, description: artigo.descricao },
  };
}

export default async function ArtigoPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const artigo = buscarArtigo(slug);
  if (!artigo) notFound();
  const { blocos, titulos, perguntas, palavras } = renderizarArtigo(artigo);
  const categoria = CATEGORIAS[artigo.categoria];
  const url = `${SITE_URL}/blog/${artigo.slug}`;
  const sumario = titulos.filter((t) => t.nivel === 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZACAO_JSONLD,
      {
        "@type": "BlogPosting",
        "@id": `${url}#artigo`,
        mainEntityOfPage: url,
        url,
        headline: artigo.titulo,
        description: artigo.descricao,
        image: `${url}/opengraph-image`,
        inLanguage: "pt-BR",
        datePublished: artigo.publicado,
        dateModified: artigo.atualizado,
        wordCount: palavras,
        articleSection: categoria.nome,
        keywords: artigo.palavrasChave.join(", "),
        author: { "@type": "Organization", name: "Equipe Leadmatic", url: SITE_URL },
        publisher: { "@id": ORGANIZACAO_JSONLD["@id"] },
        isPartOf: { "@id": `${SITE_URL}/blog#blog` },
        ...(artigo.resumo.length ? { abstract: artigo.resumo.join(" ") } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 2, name: categoria.nome, item: `${SITE_URL}/blog/categoria/${artigo.categoria}` },
          { "@type": "ListItem", position: 3, name: artigo.titulo, item: url },
        ],
      },
      ...(perguntas.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: perguntas.map((p) => ({ "@type": "Question", name: p.pergunta, acceptedAnswer: { "@type": "Answer", text: p.resposta } })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CabecalhoBlog categoriaAtiva={artigo.categoria} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <article>
          <header className="mx-auto max-w-3xl pb-8 pt-10 sm:pt-14 lg:mx-0">
            <nav aria-label="Você está em" className="text-sm text-muted-foreground">
              <Link href="/blog" className="hover:text-foreground">Blog</Link> <span aria-hidden="true">›</span>{" "}
              <Link href={`/blog/categoria/${artigo.categoria}`} className="hover:text-foreground">{categoria.nome}</Link>
            </nav>
            <h1 className="mt-4 font-lp-display text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-balance sm:text-5xl">{artigo.titulo}</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{artigo.descricao}</p>
            <p className="mt-5 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>Por <strong className="font-semibold text-foreground">Equipe Leadmatic</strong></span>
              <span aria-hidden="true">·</span>
              <span>
                {artigo.atualizado !== artigo.publicado ? "Atualizado em " : "Publicado em "}
                <time dateTime={artigo.atualizado}>{formatarData(artigo.atualizado)}</time>
              </span>
              <span aria-hidden="true">·</span>
              <span>{minutosDeLeitura(artigo)} min de leitura</span>
            </p>
          </header>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="mx-auto w-full max-w-3xl lg:mx-0">
              {artigo.resumo.length > 0 && (
                <section aria-labelledby="em-resumo" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                  <h2 id="em-resumo" className="font-lp-display text-lg font-bold tracking-tight">Em resumo</h2>
                  <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-relaxed text-muted-foreground">
                    {artigo.resumo.map((r) => (
                      <li key={r} className="flex gap-2.5">
                        <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {sumario.length > 2 && (
                <details className="group mt-6 rounded-2xl border border-border bg-card lg:hidden">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-sm font-semibold">
                    Neste artigo
                    <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                  </summary>
                  <ol className="flex flex-col gap-1 border-t border-border px-5 py-3 text-sm">
                    {sumario.map((t) => (
                      <li key={t.id}>
                        <a href={`#${t.id}`} className="block py-1.5 text-muted-foreground hover:text-foreground">{t.texto}</a>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {/* Um bloco de texto por trecho entre chamadas: a chamada fica fora do estilo de texto do artigo. */}
              <div className="mt-8">
                {blocos.map((b, i) =>
                  b.tipo === "cta" ? (
                    <ChamadaProduto key={i} campanha={artigo.slug} />
                  ) : (
                    <div key={i} className="artigo" dangerouslySetInnerHTML={{ __html: b.html }} />
                  ),
                )}
              </div>

              <ChamadaProduto campanha={artigo.slug} variante="fim" />
            </div>

            {sumario.length > 2 && (
              <aside aria-label="Neste artigo" className="hidden lg:block">
                <div className="sticky top-32">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Neste artigo</p>
                  <ol className="mt-3 flex max-h-[calc(100dvh-12rem)] flex-col gap-0.5 overflow-y-auto border-l border-border text-sm">
                    {sumario.map((t) => (
                      <li key={t.id}>
                        <a href={`#${t.id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 leading-snug text-muted-foreground hover:border-primary hover:text-foreground">
                          {t.texto}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </aside>
            )}
          </div>
        </article>

        <section aria-labelledby="continue-lendo" className="mt-16 border-t border-border pt-10">
          <h2 id="continue-lendo" className="font-lp-display text-2xl font-bold tracking-tight">Continue lendo</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {relacionados(artigo).map((a) => (
              <CartaoArtigo key={a.slug} artigo={a} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
