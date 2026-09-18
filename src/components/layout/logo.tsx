"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Marca da Revolução AI. Espera um arquivo em `/public/logo.png` — até esse
 * arquivo existir, mostra o monograma "R". A checagem roda via um objeto
 * Image() à parte antes de montar o <img> de verdade, então nunca aparece
 * o ícone de imagem quebrada (nem por um instante) enquanto o arquivo não
 * existe.
 */
export function Logo({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setReady(true);
    img.src = "/logo.png";
  }, []);

  const boxSize = size === "lg" ? "h-11 w-11" : "h-8 w-8";
  const radius = size === "lg" ? "rounded-2xl" : "rounded-lg";

  if (!ready) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-primary font-bold text-primary-foreground shadow-[0_0_0_1px_rgba(0,200,83,0.4),0_4px_16px_-4px_rgba(0,200,83,0.6)]",
          boxSize,
          radius,
          size === "lg" ? "text-lg" : "text-sm",
          className,
        )}
      >
        R
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Revolução AI" className={cn("shrink-0 object-contain", boxSize, className)} />
  );
}
