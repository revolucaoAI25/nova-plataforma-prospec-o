import Image from "next/image";
import Link from "next/link";
import { EMAIL_CONTATO } from "@/components/lp/dados";

/** Página de texto legal (privacidade, termos): pública, leve, no tema claro da plataforma. */
export function DocumentoLegal({ titulo, atualizadoEm, children }: { titulo: string; atualizadoEm: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/conheca" className="flex items-center gap-2.5 font-semibold text-foreground">
            <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
            Leadmatic
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link href="/termos" className="hover:text-foreground">Termos</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {atualizadoEm}</p>
        <div className="mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          {children}
        </div>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          Leadmatic · Revolução AI · <a href={`mailto:${EMAIL_CONTATO}`} className="hover:text-foreground">{EMAIL_CONTATO}</a>
        </div>
      </footer>
    </div>
  );
}
