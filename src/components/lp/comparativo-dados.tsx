import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl } from "./dados";

/** Dados e célula do comparativo, usados pela tabela (computador) e pela versão de celular. */

export type Valor = true | false | string;

export const COLUNAS = [
  { nome: "Leadmatic", exemplo: "esta plataforma" },
  { nome: "Tráfego pago", exemplo: "Meta Ads, Google Ads" },
  { nome: "SDR contratado", exemplo: "pré-vendas interno" },
  { nome: "Base de dados", exemplo: "listas de CNPJ + planilha" },
  { nome: "Ferramentas internacionais", exemplo: "Apollo.io e similares" },
];

/**
 * Comparação por TIPO de solução, não por marca: as linhas descrevem
 * características gerais de cada categoria (ver nota de rodapé), sem
 * números de concorrentes que possam ficar desatualizados.
 */
export function linhas(precoInicial: number | null): { criterio: string; valores: Valor[] }[] {
  return [
    { criterio: "Você escolhe exatamente quem será abordado", valores: [true, false, true, true, true] },
    { criterio: "Busca por CNPJ, Google Maps, Instagram e LinkedIn num só lugar", valores: [true, false, "Pesquisa manual", "Só CNPJ", "Foco em LinkedIn"] },
    { criterio: "Leads qualificados por atividade, porte e região", valores: [true, "Parcial", "Depende da lista", true, "Parcial no Brasil"] },
    { criterio: "Quadro societário e celular do decisor", valores: [true, false, "Pesquisa manual", "Parcial", "Foco em e-mail"] },
    { criterio: "Enriquecimento e pesquisa com IA", valores: [true, false, false, false, "Parcial"] },
    { criterio: "WhatsApp automático, por QR Code ou API oficial da Meta", valores: [true, false, "Manual", false, false] },
    { criterio: "Cadência de follow-up por WhatsApp, e-mail e LinkedIn", valores: [true, false, "Depende da rotina", false, "E-mail e LinkedIn"] },
    { criterio: "Automações visuais: buscar, enriquecer e disparar sozinho", valores: [true, false, false, false, "Parcial"] },
    { criterio: "Teste A/B das mensagens", valores: [true, "Só do anúncio", false, false, true] },
    { criterio: "Status de entregue, lida e respondida", valores: [true, false, "Manual", false, "Só e-mail"] },
    { criterio: "Ritmo que protege o número: horário, limite por dia e intervalo", valores: [true, false, "Depende da rotina", false, "Só e-mail"] },
    { criterio: "Sem empresas repetidas entre campanhas", valores: [true, false, "Depende do CRM", false, true] },
    { criterio: "Funil, relatórios e exportação para Google Sheets e Excel", valores: [true, "Só do anúncio", "Exige CRM à parte", "Só planilha", true] },
    { criterio: "Independe de leilão e aprovação de anúncios", valores: [true, false, true, true, true] },
    {
      criterio: "Custo",
      valores: [
        precoInicial ? `A partir de ${brl(precoInicial)}/mês` : "Plano mensal fixo",
        "Verba de anúncios + gestão",
        "Salário + encargos + ferramentas",
        "Assinatura + horas de trabalho manual",
        "Cobrado em dólar, por usuário",
      ],
    },
  ];
}

export function Celula({ valor, destaque }: { valor: Valor; destaque: boolean }) {
  if (valor === true) {
    return (
      <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full", destaque ? "bg-lp-accent text-[#04140a]" : "bg-white/[0.06] text-lp-muted")}>
        <Check className="h-4 w-4" strokeWidth={3} aria-label="Sim" />
      </span>
    );
  }
  if (valor === false) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.03] text-lp-muted-2">
        <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="Não" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-start gap-1.5 text-[13px] leading-snug", destaque ? "font-semibold text-lp-glow" : "text-lp-muted")}>
      {!destaque && <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lp-muted-2" aria-hidden="true" />}
      {valor}
    </span>
  );
}
