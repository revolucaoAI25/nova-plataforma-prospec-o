import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        soft: "border-transparent bg-accent text-accent-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border-strong text-foreground",
        success: "border-transparent bg-success text-success-foreground",
        destructive: "border-transparent bg-destructive-soft text-destructive",
      },
    },
    defaultVariants: { variant: "soft" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Círculo com borda verde fina e fundo verde suave — números de etapa, contadores. */
function BadgeCircle({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-accent text-xs font-bold text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Badge, BadgeCircle, badgeVariants };
