import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoBlog } from "@/components/blog/estrutura";
import { CartaoArtigo } from "@/components/blog/cartao-artigo";
import { CATEGORIAS, listarArtigos, type Categoria } from "@/lib/blog/artigos";
import { SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(CATEGORIAS).map((categoria) => ({ categoria }));
}

export async function generateMetadata({ params }: PageProps<"/blog/categoria/[categoria]">): Promise<Metadata> {
  const { categoria } = await params;
  const c = CATEGORIAS[categoria as Categoria];
  if (!c) return {};
  return {
    title: c.nome,
    description: c.descricao,
    alternates: { canonical: `/blog/categoria/${categoria}` },
    openGraph: { title: `${c.nome} · Blog do Leadmatic`, description: c.descricao, url: `/blog/categoria/${categoria}`, siteName: "Leadmatic", locale: "pt_BR" },
  };
}

export default async function CategoriaPage({ params }: PageProps<"/blog/categoria/[categoria]">) {
  const { categoria } = await params;
  const c = CATEGORIAS[categoria as Categoria];
  if (!c) notFound();
  const artigos = listarArtigos().filter((a) => a.categoria === categoria);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: c.nome,
        description: c.descricao,
        url: `${SITE_URL}/blog/categoria/${categoria}`,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE_URL}/blog#blog` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 2, name: c.nome, item: `${SITE_URL}/blog/categoria/${categoria}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CabecalhoBlog categoriaAtiva={categoria as Categoria} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-12 sm:py-14">
          <nav aria-label="Você está em" className="text-sm text-muted-foreground">
            <Link href="/blog" className="hover:text-foreground">Blog</Link> <span aria-hidden="true">›</span> {c.nome}
          </nav>
          <h1 className="mt-3 font-lp-display text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">{c.nome}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{c.descricao}</p>
        </section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {artigos.map((a) => (
            <CartaoArtigo key={a.slug} artigo={a} tituloComo="h2" />
          ))}
        </div>
      </main>
    </>
  );
}
