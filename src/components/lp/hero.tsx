import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { VideoDemonstracao } from "./video-demonstracao";

const LETREIRO = [
  "CNPJ da Receita Federal", "Google Maps", "Instagram", "LinkedIn", "WhatsApp por QR Code", "API oficial do WhatsApp",
  "E-mail com domínio próprio", "Funil Kanban", "Teste A/B", "Google Sheets", "Fluxos automáticos", "Status de leitura",
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-28 sm:pt-36">
      <div className="lp-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div className="lp-aurora -z-10 left-[10%] top-[-140px] h-[520px] w-[520px]" aria-hidden="true" />
      <div className="lp-aurora -z-10 right-[-120px] top-[260px] h-[420px] w-[420px] [--pico:0.26] [animation-delay:-7s]" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="lp-entra mx-auto inline-flex items-center gap-2 rounded-full border border-lp-line-2 bg-white/[0.03] px-3.5 py-1.5 font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-lp-accent" />
            Leads qualificados, sem depender de tráfego pago
          </p>
          <h1 className="lp-entra mt-7 font-lp-display text-[40px] font-extrabold leading-[0.98] tracking-[-0.035em] text-balance sm:text-6xl lg:text-[76px] [animation-delay:80ms]">
            Reuniões qualificadas na sua agenda, toda semana.{" "}
            <span className="block font-lp-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-lp-glow">
              Sem prospecção manual.
            </span>
          </h1>
          <p className="lp-entra mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-lp-muted sm:text-lg [animation-delay:160ms]">
            O Leadmatic encontra empresas com o perfil do seu cliente ideal, fala direto com o dono e deixa a conversa pronta para o seu comercial. Tudo chega montado e funcionando: você só atende quem responde.
          </p>
          <div className="lp-entra mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row [animation-delay:240ms]">
            <a
              href="#planos"
              className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-lp-accent px-7 text-[15px] font-semibold text-[#04140a] shadow-[0_0_0_1px_rgba(93,255,160,0.4),0_18px_50px_-12px_rgba(0,200,83,0.65)] transition-[background-color,transform] hover:bg-lp-glow active:scale-[0.98] sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow"
            >
              Começar agora
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link
              href="/teste-gratis"
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border border-lp-line-2 px-7 text-[15px] font-medium text-lp-text transition-colors hover:border-lp-accent/60 hover:bg-white/[0.03] sm:w-auto"
            >
              Testar grátis
            </Link>
          </div>
          <ul className="lp-entra mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[13px] text-lp-muted [animation-delay:280ms]">
            {["Contato direto com o dono", "Leads qualificados", "Tudo montado para você"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-lp-accent" strokeWidth={3} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          <p className="lp-entra mt-3 text-[13px] text-lp-muted-2 [animation-delay:300ms]">
            Teste grátis por 7 dias, sem cartão
          </p>
        </div>

        <div className="lp-entra mt-12 sm:mt-16 [animation-delay:340ms]">
          <VideoDemonstracao />
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-lp-muted-2">
            Para empresas de qualquer porte e segmento que vendem para outras empresas: agências, contabilidade, software,
            consultorias, energia solar, distribuidoras, serviços e muito mais.
          </p>
        </div>
      </div>

      <div className="lp-letreiro mt-16 border-y border-lp-line py-5 sm:mt-20" aria-label="Fontes e canais da plataforma">
        <div className="lp-letreiro-faixa">
          {[...LETREIRO, ...LETREIRO].map((item, i) => (
            <span key={i} aria-hidden={i >= LETREIRO.length} className="flex items-center gap-6 pr-6 font-lp-mono text-[13px] uppercase tracking-[0.14em] text-lp-muted">
              {item}
              <span className="text-lp-accent">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
