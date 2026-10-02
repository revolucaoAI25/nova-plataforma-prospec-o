import { Check, X } from "lucide-react";
import { Revela } from "./revela";

const DIAS: [string, string, string][] = [
  ["Seg", "Duas horas montando uma lista no Google. Metade dos contatos sem telefone.", "Uma nova lista chega às 7h: 80 empresas, todas com o contato do decisor."],
  ["Ter", "Quinze mensagens copiadas e coladas, uma delas com o nome errado.", "Primeiras mensagens para os novos leads e follow-up para quem foi abordado na semana anterior."],
  ["Qua", "Agenda cheia de clientes. A prospecção fica para amanhã.", "Você passa o dia em reuniões, e a cadência segue no horário programado."],
  ["Qui", "Ninguém lembra quem já recebeu o segundo contato.", "Onze respostas, todas organizadas na etapa “Respondeu” do funil."],
  ["Sex", "Duas respostas na semana, uma delas negativa.", "Quatro reuniões confirmadas para a próxima semana, com lembretes agendados."],
];

export function Semana() {
  return (
    <section className="relative border-y border-lp-line bg-lp-bg-2 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Revela className="max-w-3xl">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">A diferença na prática</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            A mesma semana,{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">com e sem a plataforma.</span>
          </h2>
        </Revela>

        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-lp-line bg-lp-line sm:mt-16">
          <div className="hidden grid-cols-[88px_1fr_1fr] bg-lp-surface sm:grid">
            <span />
            <span className="px-6 py-4 font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted-2">Prospecção manual</span>
            <span className="border-l border-lp-line px-6 py-4 font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-glow">Com a plataforma</span>
          </div>
          {DIAS.map(([dia, sem, com], i) => (
            <Revela key={dia} atraso={i * 90} className="grid bg-lp-surface sm:grid-cols-[88px_1fr_1fr]">
              <span className="flex items-center px-5 pt-5 font-lp-display text-xl font-bold text-lp-text sm:px-6 sm:py-6">{dia}</span>
              <p className="flex items-start gap-3 px-5 py-3 text-[15px] leading-relaxed text-lp-muted-2 sm:px-6 sm:py-6">
                <X className="mt-1 h-4 w-4 shrink-0 text-lp-warn/80" aria-hidden="true" />
                <span className="sr-only">Prospecção manual:</span>
                {sem}
              </p>
              <p className="flex items-start gap-3 border-lp-line px-5 pb-5 pt-1 text-[15px] leading-relaxed text-lp-text sm:border-l sm:px-6 sm:py-6">
                <Check className="mt-1 h-4 w-4 shrink-0 text-lp-accent" aria-hidden="true" />
                <span className="sr-only">Com a plataforma:</span>
                {com}
              </p>
            </Revela>
          ))}
        </div>
        <p className="mt-5 text-sm text-lp-muted-2">Semana ilustrativa. O ritmo real depende do volume e dos canais escolhidos.</p>
      </div>
    </section>
  );
}
