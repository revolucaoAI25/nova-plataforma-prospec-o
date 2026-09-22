import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  primary: "bg-accent text-primary shadow-[inset_0_0_0_1px_rgba(0,200,83,0.25)]",
  info: "bg-info-soft text-info shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]",
  violet: "bg-violet-soft text-violet shadow-[inset_0_0_0_1px_rgba(168,85,247,0.25)]",
  amber: "bg-amber-soft text-amber shadow-[inset_0_0_0_1px_rgba(245,166,35,0.25)]",
  destructive: "bg-destructive-soft text-destructive shadow-[inset_0_0_0_1px_rgba(255,92,92,0.25)]",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  return (
    <Card interactive className={cn("relative overflow-hidden p-5", className)}>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.15] blur-2xl",
          tone === "primary" && "bg-primary",
          tone === "info" && "bg-info",
          tone === "violet" && "bg-violet",
          tone === "amber" && "bg-amber",
          tone === "destructive" && "bg-destructive",
        )}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE_CLASSES[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="relative mt-3 text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint && <p className="relative mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
