import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  label: string;
  value: number;
  onChange: (km: number) => void;
  min?: number;
  max: number;
  step?: number;
  /** Texto do valor quando ele é 0 (ex.: "Desligado"). */
  zero?: string;
  disabled?: boolean;
  className?: string;
}

/** Raio em km, de arrastar — usado no "cidades vizinhas" (CNPJ) e no raio a partir de um endereço (Maps). */
export function RaioSlider({ id, label, value, onChange, min = 0, max, step = 1, zero, disabled, className }: Props) {
  return (
    <div className={cn("flex max-w-sm flex-col gap-2.5", disabled && "opacity-50", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-primary">
          {value === 0 && zero ? zero : `${value} km`}
        </span>
      </div>
      <Slider id={id} min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} disabled={disabled} />
      <div className="flex justify-between text-xs text-muted-2">
        <span>{min === 0 && zero ? zero : `${min} km`}</span>
        <span>{max} km</span>
      </div>
    </div>
  );
}
