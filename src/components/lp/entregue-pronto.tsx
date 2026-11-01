import { Cable, Check, MessageCircle, PackageCheck, UserRound } from "lucide-react";
import { Revela } from "./revela";

const SUA_PARTE = [
  {
    icone: UserRound,
    titulo: "Contar sobre o seu negócio",
    texto: "O que você vende, para quem e quem decide a compra. Leva poucos minutos.",
  },
  {
    icone: Cable,
    titulo: "Conectar os seus canais de prospecção",
    texto: "WhatsApp, e-mail e LinkedIn, em poucos cliques.",
  },
  {
    icone: MessageCircle,
    titulo: "Atender quem responder",
    texto: "As conversas chegam separadas no seu funil, prontas para você assumir.",
  },
];

const PRONTO = [
  "Estratégia de prospecção personalizada para o seu público",
  "Empresas com o perfil do seu cliente ideal, com lista nova todos os dias",
  "Contato de quem decide em cada empresa",
  "Mensagens escritas para o seu negócio, em cada etapa do follow-up",
  "Cadência por WhatsApp, e-mail e LinkedIn, com horários e ritmo definidos",
  "Automações que buscam, enriquecem e abordam as empresas todos os dias",
  "Funil montado, com quem respondeu separado para você",
];

/** Reforça que o cliente não monta nada: a prospecção chega pronta e funcionando. */
export function EntreguePronto() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Revela className="max-w-3xl">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Sem trabalho para você</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            Você não monta nada.{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">Recebe tudo pronto e funcionando.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-lp-muted">
            Nada de aprender ferramenta, montar lista ou escrever sequência de mensagens. A partir do que você conta sobre o seu
            negócio, a prospecção inteira é montada sob medida e entregue rodando. A sua parte é conversar com quem responde.
          </p>
        </Revela>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Revela>
            <div className="flex h-full flex-col rounded-[28px] border border-lp-line bg-lp-surface p-7 sm:p-8">
              <h3 className="font-lp-display text-xl font-bold tracking-tight">A sua parte</h3>
              <p className="text-[13px] text-lp-muted-2">Três passos, uma vez só</p>
              <ol className="mt-6 flex flex-col gap-5">
                {SUA_PARTE.map((p, i) => (
                  <li key={p.titulo} className="flex items-start gap-4">
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lp-line-2 bg-white/[0.03] text-lp-muted">
                      <p.icone className="h-5 w-5" aria-hidden="true" />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-lp-bg font-lp-mono text-[10px] text-lp-muted ring-1 ring-lp-line-2">
                        {i + 1}
                      </span>
                    </span>
                    <div>
                      <p className="font-semibold text-lp-text">{p.titulo}</p>
                      <p className="mt-0.5 text-[15px] leading-relaxed text-lp-muted">{p.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Revela>

          <Revela atraso={120}>
            <div className="flex h-full flex-col rounded-[28px] border border-lp-accent/50 bg-gradient-to-b from-[#0c2318] to-lp-surface p-7 shadow-[0_30px_80px_-40px_rgba(0,200,83,0.6)] sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lp-accent/40 bg-lp-accent-soft text-lp-glow">
                  <PackageCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-lp-display text-xl font-bold tracking-tight">O que já chega pronto para você</h3>
                  <p className="text-[13px] text-lp-glow">Personalizado para o seu negócio, desde o primeiro dia</p>
                </div>
              </div>
              <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
                {PRONTO.map((t) => (
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
          Quer ajustar uma mensagem, o público ou o ritmo? Tudo fica editável. Mas não precisa: do jeito que chega, já está prospectando.
        </p>
      </div>
    </section>
  );
}
