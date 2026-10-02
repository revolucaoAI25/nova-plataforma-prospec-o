import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, type PlanoLP } from "./dados";
import { Revela } from "./revela";

type Valor = true | false | string;

const COLUNAS = [
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
function linhas(precoInicial: number | null): { criterio: string; valores: Valor[] }[] {
  return [
    { criterio: "Você escolhe exatamente quem será abordado", valores: [true, false, true, true, true] },
    { criterio: "Leads qualificados por atividade, porte e região", valores: [true, "Parcial", "Depende da lista", true, "Parcial no Brasil"] },
    { criterio: "Dados de empresas brasileiras (CNPJ e Receita Federal)", valores: [true, false, "Pesquisa manual", true, "Limitado"] },
    { criterio: "Quadro societário e contato do decisor", valores: [true, false, "Pesquisa manual", "Parcial", "Foco em e-mail"] },
    { criterio: "Enriquecimento e pesquisa com IA", valores: [true, false, false, false, "Parcial"] },
    { criterio: "Abordagem automática por WhatsApp", valores: [true, false, "Manual", false, false] },
    { criterio: "Follow-up automático em vários canais", valores: [true, false, "Depende da rotina", false, "E-mail e LinkedIn"] },
    { criterio: "Funil e relatórios integrados", valores: [true, "Só do anúncio", "Exige CRM à parte", false, true] },
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

function Celula({ valor, destaque }: { valor: Valor; destaque: boolean }) {
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

export function Comparativo({ planos }: { planos: PlanoLP[] }) {
  const precoInicial = planos.length ? Math.min(...planos.map((p) => p.precoMes)) : null;
  const dados = linhas(precoInicial);

  return (
    <section id="comparativo" className="relative scroll-mt-20 border-t border-lp-line py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Revela className="max-w-3xl">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Comparativo</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            O que muda em relação{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">às outras formas de gerar clientes.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-lp-muted">
            Cada alternativa resolve uma parte do problema. A plataforma reúne, em um só lugar, a lista qualificada, o decisor, a
            abordagem e o acompanhamento.
          </p>
        </Revela>

        <Revela className="mt-12 sm:mt-14">
          <p className="mb-3 font-lp-mono text-[11px] uppercase tracking-[0.12em] text-lp-muted-2 lg:hidden">Deslize a tabela para comparar →</p>
          <div className="overflow-x-auto rounded-[28px] border border-lp-line bg-lp-surface">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <caption className="sr-only">Comparativo entre a plataforma e outras formas de gerar clientes</caption>
              <thead>
                <tr className="border-b border-lp-line">
                  <th scope="col" className="sticky left-0 z-10 w-[26%] bg-lp-surface px-5 py-5" />
                  {COLUNAS.map((c, i) => (
                    <th
                      key={c.nome}
                      scope="col"
                      className={cn("px-4 py-5 align-bottom", i === 0 && "bg-lp-accent-soft")}
                    >
                      <span className={cn("block font-lp-display text-[15px] font-bold tracking-tight", i === 0 ? "text-lp-glow" : "text-lp-text")}>
                        {c.nome}
                      </span>
                      <span className="mt-0.5 block font-lp-mono text-[10px] uppercase tracking-[0.1em] text-lp-muted-2">{c.exemplo}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.map((linha) => (
                  <tr key={linha.criterio} className="border-b border-lp-line/70 last:border-0">
                    <th scope="row" className="sticky left-0 z-10 w-[160px] bg-lp-surface px-4 py-4 text-[13px] font-medium text-lp-text sm:w-auto sm:px-5 sm:text-[14px]">
                      {linha.criterio}
                    </th>
                    {linha.valores.map((v, i) => (
                      <td key={i} className={cn("px-4 py-4 align-middle", i === 0 && "bg-lp-accent-soft")}>
                        <Celula valor={v} destaque={i === 0} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-lp-muted-2">
            Comparação por tipo de solução, com base nas características gerais de cada categoria. Ferramentas e fornecedores
            específicos podem variar.
          </p>
        </Revela>
      </div>
    </section>
  );
}
