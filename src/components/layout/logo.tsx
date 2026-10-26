import { cn } from "@/lib/utils";

/**
 * Marca do Revolução AI. Usa a versão pequena da logo (`/logo-icone.webp`,
 * 128px, ~7 KB): aparece no máximo com 44px, então a original de alta
 * resolução só pesaria a página. Renderiza direto no HTML, sem esperar o
 * JavaScript (antes mostrava um "R" provisório até a imagem carregar).
 */
export function Logo({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const px = size === "lg" ? 44 : 32;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icone.webp"
      alt="Revolução AI"
      width={px}
      height={px}
      decoding="async"
      className={cn("shrink-0 rounded-full object-contain", size === "lg" ? "h-11 w-11" : "h-8 w-8", className)}
    />
  );
}
