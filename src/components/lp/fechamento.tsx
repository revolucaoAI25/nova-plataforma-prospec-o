import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { EMAIL_CONTATO, linkWhatsApp, whatsappExibicao } from "./dados";
import { Revela } from "./revela";

export const PERGUNTAS: [string, string][] = [
  [
    "Como funciona a contratação?",
    "Você escolhe o plano, cria a sua conta e conclui o pagamento por Pix, boleto ou cartão. Assim que o pagamento é confirmado, os créditos e os recursos do plano são liberados e o onboarding começa.",
  ],
  [
    "Preciso investir em tráfego pago também?",
    "Não. A prospecção ativa gera oportunidades sem anúncios: você escolhe as empresas e a plataforma inicia a conversa com quem decide. Se você já investe em tráfego, as duas estratégias se complementam, e a sua agenda deixa de depender de um único canal.",
  ],
  [
    "Preciso de conhecimento técnico?",
    "Não. Você responde ao questionário, escolhe uma das estratégias criadas pela IA e conecta o seu WhatsApp pelo QR Code. A partir daí, basta revisar as mensagens, se quiser, e ativar a campanha.",
  ],
  [
    "A plataforma é indicada para o meu negócio?",
    "Ela funciona melhor para empresas que vendem para outras empresas ou para negócios locais: softwares, serviços, agências, consultorias, distribuidores, escritórios e fornecedores. Para vendas em massa ao consumidor final, provavelmente não é a ferramenta mais adequada.",
  ],
  [
    "Existe risco de bloqueio do WhatsApp?",
    "Todo envio por número comum envolve algum risco. Por isso, a plataforma respeita o horário comercial, limita os novos contatos por dia, espaça as mensagens e interrompe o envio para quem respondeu ou pediu para sair. Para eliminar esse risco, é possível usar a API oficial do WhatsApp (a Meta cobra por conversa, à parte).",
  ],
  [
    "De onde vêm os dados? O uso é permitido?",
    "São dados públicos de empresas: cadastro na Receita Federal e perfis no Google Maps, no Instagram e no LinkedIn. A abordagem entre empresas costuma se apoiar no legítimo interesse previsto na LGPD, desde que o destinatário tenha uma forma simples de sair. A plataforma já oferece descadastro no e-mail e opt-out no WhatsApp.",
  ],
  [
    "Em quanto tempo surgem os primeiros resultados?",
    "Depende do mercado, da oferta e da mensagem. As primeiras mensagens podem ser enviadas no mesmo dia da contratação, e é comum que as primeiras respostas apareçam já na primeira semana de cadência.",
  ],
  [
    "Como funcionam os créditos?",
    "Ações com custo operacional, como buscar uma empresa ou localizar o contato do decisor, consomem créditos do seu plano. O saldo é único para todas as funções e, se acabar antes da renovação, você pode adquirir um pacote avulso. A busca por CNPJ é a fonte mais econômica; buscas no Google Maps e no LinkedIn consomem mais créditos por empresa.",
  ],
  [
    "Existe fidelidade?",
    "O plano mensal não tem fidelidade e pode ser cancelado quando você quiser. O plano anual tem valor reduzido e é cobrado uma vez por ano.",
  ],
  [
    "Posso usar a minha própria lista de contatos?",
    "Sim. Você pode importar a sua planilha e utilizar as mesmas cadências, o mesmo funil e os mesmos relatórios.",
  ],
];

export function Duvidas() {
  return (
    <section id="duvidas" className="relative scroll-mt-20 border-t border-lp-line py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <Revela>
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Perguntas frequentes</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-5xl">
            O que você precisa saber{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">antes de começar.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-lp-muted">
            Ainda tem dúvidas?{" "}
            <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="text-lp-glow underline-offset-4 hover:underline">
              Fale com a nossa equipe pelo WhatsApp
            </a>
            .
          </p>
        </Revela>
        <div className="flex flex-col">
          {PERGUNTAS.map(([p, r], i) => (
            <Revela key={p} atraso={i * 50}>
              <details className="group border-b border-lp-line py-1 [&[open]_.lp-mais]:rotate-45">
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-left font-lp-display text-lg font-semibold tracking-tight text-lp-text transition-colors hover:text-lp-glow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-glow sm:text-xl">
                  {p}
                  <Plus className="lp-mais h-5 w-5 shrink-0 text-lp-accent transition-transform duration-300" />
                </summary>
                <p className="max-w-2xl pb-6 text-[16px] leading-relaxed text-lp-muted">{r}</p>
              </details>
            </Revela>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ChamadaFinal() {
  return (
    <section className="relative overflow-hidden border-t border-lp-line py-24 sm:py-36">
      <div className="lp-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div className="lp-aurora left-1/2 top-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
      <Revela className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="font-lp-display text-[40px] font-extrabold leading-[1] tracking-[-0.035em] text-balance sm:text-7xl">
          A prospecção que sempre fica para depois{" "}
          <span className="font-lp-serif font-normal italic text-lp-glow">pode começar hoje.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-lp-muted">
          Escolha o plano, crie a sua conta e, em poucos minutos, a IA monta a sua primeira estratégia de prospecção.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#planos"
            className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lp-accent px-8 text-base font-semibold text-[#04140a] shadow-[0_0_0_1px_rgba(93,255,160,0.4),0_20px_60px_-12px_rgba(0,200,83,0.7)] transition-[background-color,transform] hover:bg-lp-glow active:scale-[0.98] sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow"
          >
            Escolher meu plano
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href={linkWhatsApp()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full border border-lp-line-2 px-8 text-base text-lp-text transition-colors hover:border-lp-accent/60 sm:w-auto"
          >
            Falar com um especialista <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-6 text-sm text-lp-muted-2">
          Já é cliente?{" "}
          <Link href="/login" className="-my-2 inline-block py-2 text-lp-muted underline-offset-4 hover:text-lp-text hover:underline">Entrar na plataforma</Link>
        </p>
      </Revela>
    </section>
  );
}

export function Rodape() {
  return (
    <footer className="border-t border-lp-line py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 text-sm text-lp-muted sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-full" />
          <span>Prospecção Ativa · Revolução AI</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="-my-2 py-2 transition-colors hover:text-lp-text">{whatsappExibicao()}</a>
          <a href={`mailto:${EMAIL_CONTATO}`} className="-my-2 py-2 transition-colors hover:text-lp-text">{EMAIL_CONTATO}</a>
          <a href="https://revolucao-ai.com" target="_blank" rel="noopener noreferrer" className="-my-2 py-2 transition-colors hover:text-lp-text">revolucao-ai.com</a>
        </div>
      </div>
    </footer>
  );
}
