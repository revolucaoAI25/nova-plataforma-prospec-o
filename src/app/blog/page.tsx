import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CabecalhoBlog } from "@/components/blog/estrutura";
import { CartaoArtigo } from "@/components/blog/cartao-artigo";
import { CATEGORIAS, listarArtigos, type Categoria } from "@/lib/blog/artigos";
import { ORGANIZACAO_JSONLD, SITE_URL } from "@/lib/site";

const titulo = "Blog do Leadmatic: prospecção ativa e geração de clientes B2B";
const descricao =
  "Guias completos sobre prospecção ativa, WhatsApp, cold e-mail, LinkedIn, comparativos de ferramentas e como conseguir clientes em cada segmento B2B.";

export const metadata: Metadata = {
  title: { absolute: titulo },
  description: descricao,
  alternates: { canonical: "/blog" },
  openGraph: { title: titulo, description: descricao, type: "website", url: "/blog", siteName: "Leadmatic", locale: "pt_BR" },
  twitter: { card: "summary_large_image", title: titulo, description: descricao },
};

export default function BlogPage() {
  const artigos = listarArtigos();
  const destaques = artigos.filter((a) => a.destaque).slice(0, 3);
  const principal = destaques[0] ?? artigos[0];
  const secundarios = destaques.length > 1 ? destaques.slice(1) : artigos.slice(1, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZACAO_JSONLD,
      {
        "@type": "Blog",
        "@id": `${SITE_URL}/blog#blog`,
        url: `${SITE_URL}/blog`,
        name: "Blog do Leadmatic",
        description: descricao,
        inLanguage: "pt-BR",
        publisher: { "@id": ORGANIZACAO_JSONLD["@id"] },
        blogPost: artigos.map((a) => ({
          "@type": "BlogPosting",
          headline: a.titulo,
          url: `${SITE_URL}/blog/${a.slug}`,
          datePublished: a.publicado,
          dateModified: a.atualizado,
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CabecalhoBlog />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-12 sm:py-16">
          <p className="text-sm font-semibold text-primary-dark">Blog do Leadmatic</p>
          <h1 className="mt-3 max-w-3xl font-lp-display text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">
            Prospecção ativa e geração de clientes B2B, sem enrolação
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Guias práticos e comparativos para quem precisa de mais clientes: como montar a lista certa, abordar por WhatsApp, e-mail e LinkedIn,
            medir o que funciona e escolher as ferramentas.
          </p>
        </section>

        {principal && (
          <section aria-label="Em destaque" className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <CartaoArtigo artigo={principal} grande tituloComo="h2" />
            <div className="grid gap-5">
              {secundarios.map((a) => (
                <CartaoArtigo key={a.slug} artigo={a} tituloComo="h2" />
              ))}
            </div>
          </section>
        )}

        {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => {
          const daCategoria = artigos.filter((a) => a.categoria === c);
          if (!daCategoria.length) return null;
          return (
            <section key={c} aria-labelledby={`cat-${c}`} className="mt-16">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 id={`cat-${c}`} className="font-lp-display text-2xl font-bold tracking-tight">{CATEGORIAS[c].nome}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{CATEGORIAS[c].descricao}</p>
                </div>
                {daCategoria.length > 6 && (
                  <Link href={`/blog/categoria/${c}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-dark hover:underline">
                    Ver todos ({daCategoria.length}) <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {daCategoria.slice(0, 6).map((a) => (
                  <CartaoArtigo key={a.slug} artigo={a} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
