import { Check, Crosshair, Megaphone, X } from "lucide-react";
import { Revela } from "./revela";

const TRAFEGO = [
  "O custo por lead sobe a cada leilão, e o orçamento precisa crescer junto.",
  "O algoritmo decide quem vê o seu anúncio, não você.",
  "Uma conta bloqueada ou um anúncio reprovado paralisa a captação.",
  "Muitos contatos curiosos, poucos com perfil e poder de compra.",
];

const ATIVA = [
  "Você escolhe quem será abordado: atividade, porte, região e tempo de empresa.",
  "Custo previsível, baseado em créditos, sem leilão e sem verba de anúncio.",
  "Nenhuma dependência de aprovação de anúncios ou de mudanças de algoritmo.",
  "Leads qualificados desde o primeiro contato: o perfil é filtrado antes da mensagem.",
];

/** Contraste entre depender de tráfego pago e ter uma prospecção ativa própria. */
export function SemTrafego() {
  return (
    <section className="relative border-y border-lp-line bg-lp-bg-2 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Revela className="max-w-3xl">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Previsibilidade comercial</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            Sua agenda não precisa{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">depender da Meta.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-lp-muted">
            No tráfego pago, você espera que o cliente certo encontre o seu anúncio. Na prospecção ativa, você vai até ele: escolhe
            as empresas com o perfil ideal e inicia a conversa com quem decide.
          </p>
        </Revela>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-14 md:grid-cols-2">
          <Revela>
            <div className="flex h-full flex-col rounded-[28px] border border-lp-line bg-lp-surface p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lp-line-2 bg-white/[0.03] text-lp-muted">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-lp-display text-xl font-bold tracking-tight text-lp-muted">Depender só de tráfego pago</h3>
                  <p className="text-[13px] text-lp-muted-2">Quem decide é o algoritmo</p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                {TRAFEGO.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed text-lp-muted-2">
                    <X className="mt-1 h-4 w-4 shrink-0 text-lp-warn/80" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Revela>
          <Revela atraso={120}>
            <div className="flex h-full flex-col rounded-[28px] border border-lp-accent/50 bg-gradient-to-b from-[#0c2318] to-lp-surface p-7 shadow-[0_30px_80px_-40px_rgba(0,200,83,0.6)] sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lp-accent/40 bg-lp-accent-soft text-lp-glow">
                  <Crosshair className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-lp-display text-xl font-bold tracking-tight">Prospecção ativa com a plataforma</h3>
                  <p className="text-[13px] text-lp-glow">Quem decide é você</p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                {ATIVA.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed text-lp-text">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-lp-accent" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Revela>
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-lp-muted-2">
          Já investe em anúncios? As duas estratégias funcionam bem juntas. A diferença é que a sua geração de oportunidades deixa
          de depender de um único canal.
        </p>
      </div>
    </section>
  );
}
