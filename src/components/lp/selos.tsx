import { BadgeCheck, Landmark, Lock, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SELOS: { icone: LucideIcon; titulo: string; texto: string }[] = [
  { icone: Lock, titulo: "Pagamento seguro", texto: "Ambiente criptografado" },
  { icone: ShieldCheck, titulo: "Dados protegidos", texto: "Conforme a LGPD" },
  { icone: Landmark, titulo: "Dados oficiais", texto: "Base da Receita Federal" },
  { icone: BadgeCheck, titulo: "WhatsApp oficial", texto: "API oficial disponível" },
];

/** Selos de confiança perto da decisão de compra (planos e contratação). */
export function Selos({ compacto = false, className }: { compacto?: boolean; className?: string }) {
  return (
    <ul
      aria-label="Segurança e confiança"
      className={cn("grid w-full gap-2", compacto ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4", className)}
    >
      {SELOS.map(({ icone: Icone, titulo, texto }) => (
        <li key={titulo} className="flex items-center gap-2.5 rounded-xl border border-lp-line bg-white/[0.02] px-3 py-2.5 text-left">
          <Icone className="h-[18px] w-[18px] shrink-0 text-lp-accent" aria-hidden="true" />
          <span className="min-w-0 leading-tight">
            <span className="block text-[12.5px] font-semibold text-lp-text">{titulo}</span>
            <span className="block text-[11.5px] text-lp-muted-2">{texto}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
