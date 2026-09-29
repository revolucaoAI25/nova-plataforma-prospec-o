import { Coins } from "lucide-react";

/**
 * Indicador sutil do custo em créditos, logo acima do botão de buscar.
 * Mostra só a taxa por unidade (não multiplica pelo limite escolhido) —
 * versão anterior mostrava "até 1.200 créditos" pra buscas com limite
 * alto, um número grande e alarmante que não refletia o custo real (o
 * débito é pelo que for ENCONTRADO, quase sempre bem menos que o limite).
 * Mais simples e mais honesto: só a taxa, com a ressalva de que o total
 * depende do resultado.
 */
export function CreditoEstimado({
  custoPorUnidade,
  unidade = "resultado",
}: {
  custoPorUnidade: number;
  unidade?: string;
}) {
  if (custoPorUnidade <= 0) return null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Coins className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="font-semibold text-foreground">{custoPorUnidade}</span>{" "}
      {custoPorUnidade === 1 ? "crédito" : "créditos"} por {unidade}
      <span className="text-muted-2">— cobrado só pelo que for encontrado</span>
    </p>
  );
}
