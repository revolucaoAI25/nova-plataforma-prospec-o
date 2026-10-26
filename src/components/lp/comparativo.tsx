import { cn } from "@/lib/utils";
import { type PlanoLP } from "./dados";
import { Revela } from "./revela";
import { Celula, COLUNAS, linhas } from "./comparativo-dados";
import { ComparativoCelular } from "./comparativo-celular";

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
            Cada alternativa resolve uma parte do problema. O Leadmatic reúne, em um só lugar, a lista qualificada, o decisor, a
            abordagem e o acompanhamento.
          </p>
        </Revela>

        <Revela className="mt-12 sm:mt-14">
          {/* Celular e tablet: Leadmatic contra uma alternativa por vez (a tabela de 5 colunas não cabe). */}
          <ComparativoCelular linhas={dados} />
          <div className="hidden overflow-x-auto rounded-[28px] border border-lp-line bg-lp-surface lg:block">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <caption className="sr-only">Comparativo entre o Leadmatic e outras formas de gerar clientes</caption>
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
