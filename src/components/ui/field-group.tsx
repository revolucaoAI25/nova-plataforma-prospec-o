import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lista agrupada — um único contêiner com divisores finos entre linhas,
 * em vez de cada linha ter sua própria caixa com borda arredondada (era
 * a origem do efeito "retângulo dentro de retângulo, vários ao mesmo
 * tempo" quando várias FieldRow apareciam em sequência).
 */
export function FieldGroup({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("divide-y divide-border overflow-hidden rounded-xl border border-border bg-secondary/20", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function FieldRow({
  label,
  description,
  control,
  className,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-4 p-3.5 text-sm", className)}>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">{label}</span>
        {description && <span className="text-xs font-normal leading-relaxed text-muted-foreground">{description}</span>}
      </span>
      <span className="shrink-0">{control}</span>
    </label>
  );
}

/** Subtítulo pequeno acima de um FieldGroup ou bloco de campos — mesma linguagem visual dos rótulos de seção da sidebar. */
export function FieldGroupLabel({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2", className)} {...props}>
      {children}
    </p>
  );
}
