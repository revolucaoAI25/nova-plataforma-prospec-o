import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Moldura de "tela do produto" usada nas cenas: barra com o caminho e um status. */
export function Janela({
  caminho,
  status,
  children,
  className,
}: {
  caminho: string;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[22px] border border-lp-line-2 bg-lp-surface shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.02)_inset]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-lp-line bg-white/[0.015] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 font-lp-mono text-[11px] text-lp-muted-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-lp-accent/80" />
          <span className="truncate">{caminho}</span>
        </div>
        {status && <div className="shrink-0 font-lp-mono text-[10.5px] uppercase tracking-[0.12em] text-lp-muted">{status}</div>}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function Selo({ children, tom = "neutro", className }: { children: ReactNode; tom?: "neutro" | "verde" | "ambar"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-lp-mono text-[10px] uppercase tracking-[0.1em]",
        tom === "verde" && "border-lp-accent/40 bg-lp-accent-soft text-lp-glow",
        tom === "ambar" && "border-[#f5b544]/30 bg-[#f5b544]/10 text-[#f5c46b]",
        tom === "neutro" && "border-lp-line-2 bg-white/[0.03] text-lp-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
