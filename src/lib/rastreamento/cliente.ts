// Rastreamento no navegador: identifica o visitante (cookie próprio), guarda
// a origem da campanha (utm_*), manda os passos para o nosso funil
// (/api/lp/evento) e repassa os eventos padrão ao Pixel da Meta.
//
// Os cookies lm_vid e lm_origem também são lidos pelo servidor no cadastro
// (ver servidor.ts), para ligar a conta e a compra à campanha que trouxe a
// pessoa. Nada aqui guarda dado pessoal: só ids aleatórios e parâmetros da URL.

export const COOKIE_VISITANTE = "lm_vid";
export const COOKIE_ORIGEM = "lm_origem";

const UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type Origem = Partial<Record<(typeof UTMS)[number] | "pagina_entrada", string>>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function lerCookie(nome: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${nome}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function gravarCookie(nome: string, valor: string, dias: number) {
  const seguro = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${nome}=${encodeURIComponent(valor)}; Max-Age=${dias * 86400}; Path=/; SameSite=Lax${seguro}`;
}

function idAleatorio(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function visitanteId(): string {
  let id = lerCookie(COOKIE_VISITANTE);
  if (!id) {
    id = idAleatorio();
    gravarCookie(COOKIE_VISITANTE, id, 365);
  }
  return id;
}

function sessaoId(): string {
  try {
    let id = sessionStorage.getItem("lm_sessao");
    if (!id) {
      id = idAleatorio();
      sessionStorage.setItem("lm_sessao", id);
    }
    return id;
  } catch {
    return "";
  }
}

export function origemSalva(): Origem {
  try {
    return JSON.parse(lerCookie(COOKIE_ORIGEM) || "{}") as Origem;
  } catch {
    return {};
  }
}

/**
 * Chegou com utm_* na URL: vale a campanha desta visita (último clique pago),
 * por 90 dias. Sem utm, mantém a origem anterior.
 */
export function capturarOrigem() {
  const params = new URLSearchParams(location.search);
  const nova: Origem = {};
  for (const k of UTMS) {
    const v = params.get(k);
    if (v) nova[k] = v.slice(0, 200);
  }
  if (Object.keys(nova).length) {
    nova.pagina_entrada = location.pathname;
    gravarCookie(COOKIE_ORIGEM, JSON.stringify(nova), 90);
  }
}

function dispositivo(): string {
  const w = window.innerWidth;
  return w < 768 ? "celular" : w < 1024 ? "tablet" : "computador";
}

/** Um passo do funil (visita, seção vista, clique…), enviado sem atrasar a navegação. */
export function registrarEvento(evento: string, alvo?: string | null) {
  try {
    const origem = origemSalva();
    const corpo = JSON.stringify({
      visitante: visitanteId(),
      sessao: sessaoId(),
      evento,
      // A raiz, para quem não está logado, é a página de vendas (rewrite no proxy).
      pagina: location.pathname === "/" ? "/conheca" : location.pathname,
      alvo: alvo ?? null,
      referrer: document.referrer ? new URL(document.referrer).hostname : null,
      dispositivo: dispositivo(),
      ...origem,
    });
    const blob = new Blob([corpo], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/lp/evento", blob)) {
      void fetch("/api/lp/evento", { method: "POST", body: corpo, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // Rastreamento nunca pode quebrar a página.
  }
}

/** Evento no Pixel da Meta (padrão ou personalizado). `eventId` casa com o mesmo evento mandado pelo servidor. */
export function eventoPixel(nome: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  const padrao = ["PageView", "ViewContent", "Lead", "CompleteRegistration", "StartTrial", "InitiateCheckout", "AddPaymentInfo", "Purchase", "Contact", "Subscribe"];
  const tipo = padrao.includes(nome) ? "track" : "trackCustom";
  window.fbq(tipo, nome, params ?? {}, eventId ? { eventID: eventId } : undefined);
}

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown };
const pixelsIniciados = new Set<string>();

/**
 * Código-base do Pixel (o mesmo que a Meta entrega), rodado aqui em vez de num
 * <script> solto para garantir a ordem init → PageView → demais eventos também
 * na navegação interna entre páginas. `correspondencia` é a correspondência
 * avançada (e-mail, telefone…) — o Pixel aplica o hash antes de enviar.
 */
/**
 * Carrega um script de terceiro sem disputar o processador com a montagem da
 * página: espera o `load` e um momento ocioso (com prazo máximo). Os eventos
 * disparados antes ficam na fila do stub e saem quando o script chega.
 */
function carregarQuandoOcioso(src: string, prazoMs: number) {
  const carregar = () => {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  };
  const ocioso = () => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(carregar, { timeout: prazoMs });
    else setTimeout(carregar, Math.min(prazoMs, 1000));
  };
  if (document.readyState === "complete") ocioso();
  else window.addEventListener("load", ocioso, { once: true });
}

export function iniciarPixel(pixelId: string, correspondencia?: Record<string, string>) {
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    (window as unknown as { _fbq?: Fbq })._fbq = fbq;
    carregarQuandoOcioso("https://connect.facebook.net/en_US/fbevents.js", 1500);
  }
  if (!pixelsIniciados.has(pixelId)) {
    const preenchida = Object.fromEntries(Object.entries(correspondencia ?? {}).filter(([, v]) => v));
    window.fbq("init", pixelId, preenchida);
    pixelsIniciados.add(pixelId);
  }
}

let ultimoLeadEnviado = "";
/**
 * Preenchimento parcial dos formulários (contratação e teste grátis): com o
 * e-mail ou o WhatsApp já digitado, a pessoa entra no quadro de leads do
 * admin mesmo sem concluir. Só manda o que mudou; nunca senha nem CPF/CNPJ.
 */
export function capturarLeadParcial(dados: {
  nome?: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  pagina: "assinar" | "teste";
  plano?: string | null;
  ciclo?: "mensal" | "anual" | null;
}) {
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((dados.email ?? "").trim());
  const telefoneOk = (dados.telefone ?? "").replace(/\D/g, "").length >= 10;
  if (!emailOk && !telefoneOk) return;
  const corpo = JSON.stringify(dados);
  if (corpo === ultimoLeadEnviado) return;
  ultimoLeadEnviado = corpo;
  try {
    const blob = new Blob([corpo], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/lp/lead", blob)) return;
  } catch {
    // segue para o fetch
  }
  fetch("/api/lp/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true }).catch(() => undefined);
}
