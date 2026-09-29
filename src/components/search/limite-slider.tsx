import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  className?: string;
}

/** Controle de "número de resultados" reaproveitado nos 4 formulários de busca avulsa — arraste em vez de digitar. */
export function LimiteSlider({ label, value, onChange, min, max, step = 1, hint, className }: Props) {
  return (
    <div className={cn("flex max-w-sm flex-col gap-2.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="limite">{label}</Label>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-primary">
          {value}
        </span>
      </div>
      <Slider
        id="limite"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="flex justify-between text-xs text-muted-2">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
