import { Coins } from "lucide-react";

/**
 * Indicador sutil do custo em créditos, logo acima/ao lado do botão de
 * buscar — antes disso não havia NENHUM lugar mostrando quantos créditos
 * uma ação ia custar até ela já ter rodado. "Até" porque o débito real é
 * pelo que for ENCONTRADO, não pelo limite pedido (pode custar menos).
 */
export function CreditoEstimado({
  custoPorUnidade,
  quantidade,
  unidade = "resultado",
}: {
  custoPorUnidade: number;
  quantidade: number;
  unidade?: string;
}) {
  if (custoPorUnidade <= 0 || quantidade <= 0) return null;
  const total = custoPorUnidade * quantidade;

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Coins className="h-3.5 w-3.5 shrink-0 text-primary" />
      Até <span className="font-semibold text-foreground">{total.toLocaleString("pt-BR")}</span> créditos nesta busca
      <span className="text-muted-2">
        ({custoPorUnidade} por {unidade}, cobrado só pelo que for encontrado)
      </span>
    </p>
  );
}
