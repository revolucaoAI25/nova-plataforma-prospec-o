"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, CANAIS, linkAssinar, linkWhatsApp, num, RESPOSTA_PARA_REUNIAO, type CanalLP, type PlanoLP } from "./dados";
import { definirPlanoSugerido, useContagem, useVisto } from "./hooks";
import { Revela } from "./revela";

function Faixa({ rotulo, min, max, total, destaque }: { rotulo: string; min: number; max: number; total: number; destaque?: boolean }) {
  // Raiz quadrada só pra manter as barras legíveis quando o fim do funil é
  // bem menor que o começo; os números exatos ficam escritos ao lado.
  const largura = (v: number) => (total > 0 && v > 0 ? Math.max(4, Math.sqrt(v / total) * 100) : 0);
  const iguais = Math.round(min) === Math.round(max);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-lp-muted">{rotulo}</span>
        <span className={cn("lp-numero font-semibold", destaque ? "text-lp-glow" : "text-lp-text")}>
          {iguais ? num(max) : `${num(min)} a ${num(max)}`}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.05]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-lp-accent/30 transition-[width] duration-500" style={{ width: `${largura(max)}%` }} />
        <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", destaque ? "bg-lp-glow" : "bg-lp-accent")} style={{ width: `${largura(min)}%` }} />
      </div>
    </div>
  );
}

function Controle({ rotulo, valor, children }: { rotulo: string; valor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-lp-text">{rotulo}</span>
        {valor && <span className="lp-numero font-lp-display text-xl font-bold text-lp-glow">{valor}</span>}
      </div>
      {children}
    </div>
  );
}

function Deslizante({ valor, min, max, passo, aoMudar, rotulo }: { valor: number; min: number; max: number; passo: number; aoMudar: (v: number) => void; rotulo: string }) {
  const pct = ((valor - min) / (max - min)) * 100;
  return (
    <input
      type="range" min={min} max={max} step={passo} value={valor} aria-label={rotulo}
      onChange={(e) => aoMudar(Number(e.target.value))}
      style={{ background: `linear-gradient(to right, #00c853 ${pct}%, rgba(255,255,255,0.08) ${pct}%)` }}
    />
  );
}

export function Calculadora({ planos, creditosPorLead }: { planos: PlanoLP[]; creditosPorLead: number }) {
  const [ticket, setTicket] = useState(1500);
  const [recorrente, setRecorrente] = useState(false);
  const [empresas, setEmpresas] = useState(600);
  const [canal, setCanal] = useState<CanalLP>("whatsapp");
  const [fecha, setFecha] = useState(3);
  const [ref, visto] = useVisto<HTMLDivElement>();

  const conta = useMemo(() => {
    const [rMin, rMax] = CANAIS[canal].resposta;
    const respostas = [empresas * rMin, empresas * rMax];
    const reunioes = [respostas[0] * RESPOSTA_PARA_REUNIAO[0], respostas[1] * RESPOSTA_PARA_REUNIAO[1]];
    const clientes = [reunioes[0] * (fecha / 10), reunioes[1] * (fecha / 10)];
    const receita = [Math.round(clientes[0]) * ticket, Math.round(clientes[1]) * ticket];
    const creditos = empresas * creditosPorLead;
    const plano = [...planos].sort((a, b) => a.creditosMes - b.creditosMes).find((p) => p.creditosMes >= creditos) ?? null;
    return { respostas, reunioes, clientes, receita, creditos, plano };
  }, [canal, empresas, fecha, ticket, creditosPorLead, planos]);

  const planoId = conta.plano?.id ?? null;
  useEffect(() => {
    definirPlanoSugerido(planoId);
  }, [planoId]);

  const cliMin = Math.round(conta.clientes[0]);
  const cliMax = Math.max(cliMin, Math.round(conta.clientes[1]));
  const animMin = useContagem(cliMin, visto, 700);
  const animMax = useContagem(cliMax, visto, 900);
  const receitaMin = useContagem(conta.receita[0], visto, 900);
  const receitaMax = useContagem(conta.receita[1], visto, 1100);
  const retorno = conta.plano && conta.receita[0] > 0 ? conta.receita[0] / conta.plano.precoMes : null;
  const maiorPlano = planos.length ? Math.max(...planos.map((p) => p.creditosMes)) : 0;

  const textoZap = `Olá! Fiz a simulação na página: ${num(empresas)} empresas abordadas por mês e ticket de ${brl(ticket)}${recorrente ? " por mês" : ""}. A estimativa foi de ${cliMin} a ${cliMax} novos clientes por mês. Gostaria de entender o plano ideal para esse volume.`;

  return (
    <section id="conta" className="relative scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Revela className="max-w-3xl">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Simulação</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            Coloque os seus números.{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">Veja o resultado possível.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-lp-muted">
            A simulação usa as mesmas faixas conservadoras que a plataforma aplica ao montar as suas estratégias de prospecção.
          </p>
        </Revela>

        <div ref={ref} className="mt-12 grid grid-cols-1 gap-5 lg:mt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex flex-col gap-8 rounded-[28px] border border-lp-line bg-lp-surface p-6 sm:p-8">
            <Controle rotulo="Quanto vale um cliente novo?">
              <div className="flex items-center rounded-2xl border border-lp-line-2 bg-lp-bg/60 px-4 focus-within:border-lp-accent/60">
                <span className="text-lp-muted">R$</span>
                <input
                  type="number" inputMode="numeric" min={0} step={50} value={ticket} aria-label="Valor de um cliente novo em reais"
                  onChange={(e) => setTicket(Math.max(0, Number(e.target.value) || 0))}
                  className="lp-numero h-14 w-full min-w-0 bg-transparent px-2 font-lp-display text-2xl font-bold text-lp-text outline-none"
                />
              </div>
              <div className="flex gap-2" role="radiogroup" aria-label="Tipo de valor">
                {([[false, "Venda única"], [true, "Receita mensal recorrente"]] as const).map(([v, r]) => (
                  <button
                    key={r} type="button" role="radio" aria-checked={recorrente === v} onClick={() => setRecorrente(v)}
                    className={cn("flex-1 rounded-full border px-3 py-2 text-[13px] transition-colors", recorrente === v ? "border-lp-accent bg-lp-accent-soft text-lp-glow" : "border-lp-line-2 text-lp-muted hover:text-lp-text")}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Controle>

            <Controle rotulo="Quantas empresas abordar por mês?" valor={num(empresas)}>
              <Deslizante valor={empresas} min={100} max={3000} passo={50} aoMudar={setEmpresas} rotulo="Empresas abordadas por mês" />
            </Controle>

            <Controle rotulo="Canal principal">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Canal principal">
                {(Object.keys(CANAIS) as CanalLP[]).map((c) => (
                  <button
                    key={c} type="button" role="radio" aria-checked={canal === c} onClick={() => setCanal(c)}
                    className={cn("rounded-full border px-3 py-2 text-[13px] transition-colors", canal === c ? "border-lp-accent bg-lp-accent-soft text-lp-glow" : "border-lp-line-2 text-lp-muted hover:text-lp-text")}
                  >
                    {CANAIS[c].rotulo}
                  </button>
                ))}
              </div>
            </Controle>

            <Controle rotulo="A cada 10 reuniões, quantas você fecha?" valor={`${fecha} de 10`}>
              <Deslizante valor={fecha} min={1} max={8} passo={1} aoMudar={setFecha} rotulo="Reuniões fechadas a cada 10" />
            </Controle>
          </div>

          <div className="relative flex flex-col gap-6 overflow-hidden rounded-[28px] border border-lp-accent/30 bg-gradient-to-br from-[#0b2117] via-lp-surface to-lp-surface p-6 sm:p-8">
            <div className="lp-aurora -right-24 -top-24 h-72 w-72 opacity-40" aria-hidden="true" />
            <div className="relative" aria-live="polite">
              <p className="text-[15px] text-lp-muted">
                {cliMax === 0 ? "Com esse volume, a estimativa ainda é de" : cliMin === cliMax ? "Com esses números, a estimativa é de cerca de" : cliMin === 0 ? "Com esses números, a estimativa é de até" : "Com esses números, a estimativa é de"}
              </p>
              <p className="lp-numero mt-1 font-lp-display text-5xl font-extrabold leading-none tracking-[-0.035em] sm:text-7xl">
                {cliMax === 0
                  ? "menos de 1"
                  : cliMin === cliMax || cliMin === 0
                    ? Math.round(animMax)
                    : `${Math.round(animMin)} e ${Math.round(animMax)}`}{" "}
                <span className="font-lp-serif text-[0.6em] font-normal italic tracking-normal text-lp-glow">
                  {cliMax <= 1 ? "novo cliente por mês" : "novos clientes por mês"}
                </span>
              </p>
              <p className="mt-4 text-lg text-lp-text">
                <span className="lp-numero font-semibold">{brl(receitaMin)} a {brl(receitaMax)}</span>{" "}
                {recorrente ? "em nova receita recorrente a cada mês." : "em novas vendas por mês."}
              </p>
              {recorrente && cliMax > 0 && (
                <p className="mt-1 text-sm text-lp-muted">
                  Se esses clientes permanecerem por 12 meses, cada mês de prospecção representa {brl(conta.receita[0] * 12)} a {brl(conta.receita[1] * 12)}.
                </p>
              )}
            </div>

            <div className="relative flex flex-col gap-4 rounded-2xl border border-lp-line bg-lp-bg/50 p-5">
              <Faixa rotulo="Empresas abordadas" min={empresas} max={empresas} total={empresas} />
              <Faixa rotulo="Respostas" min={conta.respostas[0]} max={conta.respostas[1]} total={empresas} />
              <Faixa rotulo="Reuniões" min={conta.reunioes[0]} max={conta.reunioes[1]} total={empresas} />
              <Faixa rotulo="Novos clientes" min={conta.clientes[0]} max={conta.clientes[1]} total={empresas} destaque />
            </div>

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm leading-relaxed text-lp-muted">
                {conta.plano ? (
                  <>
                    O plano <span className="font-semibold text-lp-text">{conta.plano.nome}</span> ({brl(conta.plano.precoMes)}/mês) comporta esse volume.
                    {retorno !== null && retorno >= 1 && (
                      <> No cenário mais conservador, cada R$ 1 investido retorna <span className="font-semibold text-lp-glow">R$ {num(retorno)}</span>.</>
                    )}
                    {retorno !== null && retorno < 1 && <> No cenário conservador, o investimento ainda não se paga: vale aumentar o volume ou revisar a oferta.</>}
                  </>
                ) : planos.length && conta.creditos > maiorPlano ? (
                  <>Esse volume ultrapassa o maior plano. Fale com a nossa equipe para montar um plano sob medida.</>
                ) : (
                  <>Esse volume consome cerca de {num(conta.creditos)} créditos por mês. Nossa equipe ajuda você a escolher o plano.</>
                )}
              </div>
              <a
                href={conta.plano ? linkAssinar(conta.plano.id) : linkWhatsApp(textoZap)}
                {...(conta.plano ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-lp-accent px-6 text-[15px] font-semibold text-[#04140a] transition-colors hover:bg-lp-glow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow"
              >
                {conta.plano ? `Assinar o plano ${conta.plano.nome}` : "Falar com um especialista"}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>

        <p className="mt-5 max-w-4xl text-[13px] leading-relaxed text-lp-muted-2">
          Faixas utilizadas: taxa de resposta de 8% a 20% no WhatsApp, de 1% a 5% no e-mail e de 2% a 6% no LinkedIn (o uso combinado de canais
          eleva um pouco a taxa); de 20% a 35% das respostas resultam em reunião. São referências conservadoras de prospecção B2B no Brasil.
          Créditos estimados com busca por CNPJ e validação de contato ({num(creditosPorLead)} por empresa). A simulação não é uma promessa de
          resultado: a oferta e a mensagem influenciam diretamente os números.
        </p>
      </div>
    </section>
  );
}
