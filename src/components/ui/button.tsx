import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_0_1px_rgba(0,200,83,0.4),0_8px_24px_-8px_rgba(0,200,83,0.5)] hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-[0_0_0_1px_rgba(0,200,83,0.55),0_10px_32px_-6px_rgba(0,200,83,0.65)] active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground hover:-translate-y-0.5 hover:opacity-90",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:-translate-y-0.5 hover:border-border-strong",
        ghost: "rounded-md text-foreground hover:bg-secondary",
        link: "rounded-none text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2 has-[>svg]:px-5",
        sm: "h-9 rounded-full px-4 text-xs",
        lg: "h-12 rounded-full px-8 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Seta que desliza pra direita no hover — só faz sentido em CTAs primários. */
  withArrow?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, withArrow = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // Slot (asChild) exige exatamente um filho — a seta decorativa só é
    // renderizada no botão nativo, nunca junto de um asChild (ex: <Link>).
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {asChild ? (
          children
        ) : (
          <>
            {children}
            {withArrow && (
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform duration-200 group-hover/btn:translate-x-1"
              >
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
