import { Check, X } from "lucide-react";
import { Revela } from "./revela";

const DIAS: [string, string, string][] = [
  ["Seg", "Duas horas no Google montando lista. Metade sem telefone.", "Lista nova entrou sozinha às 7h. Quarenta empresas, todas com o contato de quem decide."],
  ["Ter", "Quinze mensagens no copia e cola. Em uma, o nome errado.", "Primeira mensagem pra quem entrou ontem. Follow-up pra quem recebeu semana passada."],
  ["Qua", "Dia cheio de cliente. A prospecção fica pra amanhã.", "Você em reunião o dia inteiro. A cadência seguiu no horário dela."],
  ["Qui", "Não lembra quem já recebeu o segundo contato.", "Seis pessoas responderam. Já estão na coluna “Respondeu” do funil."],
  ["Sex", "Duas respostas. Uma era “não tenho interesse”.", "Três reuniões marcadas pra semana que vem. Lembrete agendado."],
];

export function Semana() {
  return (
    <section className="relative border-y border-lp-line bg-lp-bg-2 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Revela className="max-w-3xl">
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">A diferença na prática</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
            A mesma semana.{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">Com e sem a máquina rodando.</span>
          </h2>
        </Revela>

        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-lp-line bg-lp-line sm:mt-16">
          <div className="hidden grid-cols-[88px_1fr_1fr] bg-lp-surface sm:grid">
            <span />
            <span className="px-6 py-4 font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted-2">Do jeito de sempre</span>
            <span className="border-l border-lp-line px-6 py-4 font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-glow">Com a plataforma</span>
          </div>
          {DIAS.map(([dia, sem, com], i) => (
            <Revela key={dia} atraso={i * 90} className="grid bg-lp-surface sm:grid-cols-[88px_1fr_1fr]">
              <span className="flex items-center px-5 pt-5 font-lp-display text-xl font-bold text-lp-text sm:px-6 sm:py-6">{dia}</span>
              <p className="flex items-start gap-3 px-5 py-3 text-[15px] leading-relaxed text-lp-muted-2 sm:px-6 sm:py-6">
                <X className="mt-1 h-4 w-4 shrink-0 text-lp-warn/80" aria-hidden="true" />
                <span className="sr-only">Do jeito de sempre:</span>
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
        <p className="mt-5 text-sm text-lp-muted-2">Semana ilustrativa. O ritmo real depende do volume e dos canais que você escolher.</p>
      </div>
    </section>
  );
}
