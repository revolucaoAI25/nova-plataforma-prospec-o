import Link from "next/link";
import { CATEGORIAS, formatarData, minutosDeLeitura, type Artigo } from "@/lib/blog/artigos";

export function CartaoArtigo({ artigo, grande = false, tituloComo: Titulo = "h3" }: { artigo: Artigo; grande?: boolean; tituloComo?: "h2" | "h3" }) {
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-[var(--elevation-md)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-dark">{CATEGORIAS[artigo.categoria].nome}</p>
      <Titulo className={`mt-2 font-lp-display font-bold leading-snug tracking-tight text-foreground text-balance ${grande ? "text-2xl sm:text-3xl" : "text-lg"}`}>
        <Link href={`/blog/${artigo.slug}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none group-focus-within:underline">
          {artigo.titulo}
        </Link>
      </Titulo>
      <p className={`mt-2 leading-relaxed text-muted-foreground ${grande ? "text-[15px] sm:text-base" : "line-clamp-3 text-sm"}`}>{artigo.descricao}</p>
      <p className="mt-auto pt-4 text-xs text-muted-foreground">
        <time dateTime={artigo.atualizado}>{formatarData(artigo.atualizado)}</time> · {minutosDeLeitura(artigo)} min de leitura
      </p>
    </article>
  );
}
