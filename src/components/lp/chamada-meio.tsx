import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Revela } from "./revela";

interface Botao {
  rotulo: string;
  href: string;
  externo?: boolean;
}

/** Âncora (#...) e link externo vão em <a>; rota interna vai em <Link>. */
function Destino({ b, className, children }: { b: Botao; className: string; children: React.ReactNode }) {
  if (b.externo) {
    return (
      <a href={b.href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  if (b.href.startsWith("#")) {
    return (
      <a href={b.href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={b.href} className={className}>
      {children}
    </Link>
  );
}

/**
 * Chamada curta entre seções: uma frase e o próximo passo, para quem já
 * se convenceu não precisar rolar até o fim da página.
 */
export function ChamadaMeio({ frase, principal, secundario }: { frase: string; principal: Botao; secundario?: Botao }) {
  return (
    <Revela className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col items-center gap-5 rounded-[28px] border border-lp-line bg-lp-surface/60 px-6 py-7 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
        <p className="font-lp-display text-xl font-bold tracking-tight text-balance sm:text-2xl">{frase}</p>
        <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto sm:flex-row">
          <Destino
            b={principal}
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lp-accent px-6 text-[15px] font-semibold text-[#04140a] transition-colors hover:bg-lp-glow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow"
          >
            {principal.rotulo}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Destino>
          {secundario && (
            <Destino
              b={secundario}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-lp-line-2 px-6 text-[15px] font-medium text-lp-text transition-colors hover:border-lp-accent/60 hover:bg-white/[0.03]"
            >
              {secundario.rotulo}
              {secundario.externo && <ArrowUpRight className="h-4 w-4" />}
            </Destino>
          )}
        </div>
      </div>
    </Revela>
  );
}
