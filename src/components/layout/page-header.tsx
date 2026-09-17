import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho padrão de página — eyebrow (rótulo da seção) + título + descrição,
 * com slots opcionais de botão-voltar, badge inline no título e ações à direita.
 * Substitui o h1/p repetido em cada page.tsx.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Voltar",
  badge,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-1.5">
        {backHref && (
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-1 w-fit">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </Link>
          </Button>
        )}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
