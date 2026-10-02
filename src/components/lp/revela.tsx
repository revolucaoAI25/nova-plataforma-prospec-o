"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useVisto } from "./hooks";

/** Entra com fade, subida e desfoque quando aparece na tela. */
export function Revela({ children, atraso = 0, className }: { children: ReactNode; atraso?: number; className?: string }) {
  const [ref, visto] = useVisto<HTMLDivElement>();
  return (
    <div ref={ref} data-visivel={visto} className={cn("lp-revela", className)} style={{ transitionDelay: `${atraso}ms` }}>
      {children}
    </div>
  );
}
