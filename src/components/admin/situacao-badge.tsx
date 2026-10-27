import { cn } from "@/lib/utils";
import type { Situacao } from "@/lib/admin-clientes";

const TONS: Record<Situacao["tom"], string> = {
  sucesso: "bg-success/15 text-success",
  alerta: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  perigo: "bg-destructive-soft text-destructive",
  info: "bg-accent text-accent-foreground",
  neutro: "bg-secondary text-muted-foreground",
};

/** Situação do cliente (assinante, em teste, pagamento atrasado…) como etiqueta. */
export function SituacaoBadge({ situacao, className }: { situacao: Situacao; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-semibold", TONS[situacao.tom], className)}>
      {situacao.rotulo}
    </span>
  );
}
