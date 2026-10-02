import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { EMAIL_CONTATO, linkWhatsApp, whatsappExibicao } from "./dados";
import { Revela } from "./revela";

export const PERGUNTAS: [string, string][] = [
  [
    "Preciso entender de tecnologia?",
    "Não. Você responde o questionário, escolhe uma das estratégias que a IA montou e conecta o seu WhatsApp pelo QR Code. Daí pra frente é ajustar a mensagem, se quiser, e dar play.",
  ],
  [
    "Funciona pro meu negócio?",
    "Funciona melhor pra quem vende pra empresas ou pra negócios locais: software, serviços, agências, consultorias, distribuidores, escritórios, fornecedores. Se você vende direto pro consumidor final, em massa, provavelmente não é a ferramenta certa, e a gente prefere te dizer isso antes.",
  ],
  [
    "Meu WhatsApp pode ser bloqueado?",
    "Todo disparo por número comum tem algum risco. Por isso a plataforma trabalha com horário comercial, limite de contatos novos por dia, intervalo entre mensagens e para de mandar pra quem respondeu ou pediu pra sair. Se você quer tirar esse risco da mesa, dá pra usar a API oficial do WhatsApp (a Meta cobra por conversa, à parte).",
  ],
  [
    "De onde vêm os dados? Isso pode?",
    "São dados públicos de empresas: cadastro na Receita Federal, perfis no Google Maps, no Instagram e no LinkedIn. Abordagem entre empresas costuma se apoiar no legítimo interesse previsto na LGPD, desde que quem recebe tenha uma saída fácil. A plataforma já cuida do descadastro no e-mail e do opt-out no WhatsApp.",
  ],
  [
    "Em quanto tempo aparece a primeira reunião?",
    "Depende do seu mercado, da oferta e da mensagem. A primeira mensagem pode sair no mesmo dia em que você entra, e é comum as primeiras respostas aparecerem já na primeira semana de cadência.",
  ],
  [
    "O que são os créditos?",
    "Cada ação que tem custo pra gente, como buscar uma empresa ou achar o contato do decisor, consome créditos do seu plano. É um saldo só pra tudo. Se acabar antes do mês virar, você compra um pacote avulso.",
  ],
  [
    "Tem fidelidade?",
    "No mensal, não: cancela quando quiser. O anual sai mais barato e é cobrado uma vez por ano.",
  ],
  [
    "E se eu já tiver uma lista de clientes?",
    "Pode subir a sua planilha e usar as mesmas cadências, o mesmo funil e os mesmos relatórios.",
  ],
];

export function Duvidas() {
  return (
    <section id="duvidas" className="relative scroll-mt-20 border-t border-lp-line py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <Revela>
          <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Dúvidas</p>
          <h2 className="mt-4 font-lp-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-balance sm:text-5xl">
            O que todo mundo pergunta{" "}
            <span className="font-lp-serif font-normal italic text-lp-glow">antes de começar.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-lp-muted">
            Ficou alguma? Chama no WhatsApp que quem responde é gente do time.
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
          A prospecção que vive ficando pra semana que vem{" "}
          <span className="font-lp-serif font-normal italic text-lp-glow">pode começar hoje.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-lp-muted">
          Chama a gente no WhatsApp, conta o que você vende e a gente te mostra a plataforma rodando com o seu público.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={linkWhatsApp()}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lp-accent px-8 text-base font-semibold text-[#04140a] shadow-[0_0_0_1px_rgba(93,255,160,0.4),0_20px_60px_-12px_rgba(0,200,83,0.7)] transition-[background-color,transform] hover:bg-lp-glow active:scale-[0.98] sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow"
          >
            Quero ver com o meu público
            <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
          <Link href="/login" className="inline-flex h-14 w-full items-center justify-center rounded-full border border-lp-line-2 px-8 text-base text-lp-text transition-colors hover:border-lp-accent/60 sm:w-auto">
            Já sou cliente, entrar
          </Link>
        </div>
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
          <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-lp-text">{whatsappExibicao()}</a>
          <a href={`mailto:${EMAIL_CONTATO}`} className="transition-colors hover:text-lp-text">{EMAIL_CONTATO}</a>
          <a href="https://revolucao-ai.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-lp-text">revolucao-ai.com</a>
        </div>
      </div>
    </footer>
  );
}
