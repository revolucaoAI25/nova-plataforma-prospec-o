/**
 * Dados da página de vendas. O WhatsApp de contato pode ser trocado sem
 * mexer no código: NEXT_PUBLIC_LP_WHATSAPP (só dígitos, com DDI).
 */
export const WHATSAPP_NUMERO = (process.env.NEXT_PUBLIC_LP_WHATSAPP || "553131573153").replace(/\D/g, "");
export const EMAIL_CONTATO = "contato@revolucao-ai.com";

export function linkWhatsApp(texto = "Olá! Conheci a plataforma de prospecção pela página e gostaria de entender se ela atende o meu negócio."): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
}

export function whatsappExibicao(): string {
  const d = WHATSAPP_NUMERO;
  if (d.length === 12 || d.length === 13) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    const corte = resto.length === 9 ? 5 : 4;
    return `+55 ${ddd} ${resto.slice(0, corte)}-${resto.slice(corte)}`;
  }
  return `+${d}`;
}

export const brl = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: casas, minimumFractionDigits: casas });

export const num = (v: number) => Math.round(v).toLocaleString("pt-BR");

/** Plano como a página precisa (vem da tabela `plans`). */
export interface PlanoLP {
  id: string;
  nome: string;
  descricao: string | null;
  precoMes: number;
  precoAnual: number | null;
  creditosMes: number;
  /** Teto de empresas por mês: créditos ÷ custo da fonte de extração mais barata do plano. */
  empresasMes: number | null;
  recursos: string[];
}

/**
 * Faixas de resposta por canal e de resposta → reunião. São as mesmas
 * referências conservadoras que a IA do onboarding usa pra estimar as
 * sugestões (src/lib/onboarding/estimativa.ts), pra página não prometer
 * mais do que a plataforma estima depois.
 */
export const CANAIS = {
  whatsapp: { rotulo: "WhatsApp", resposta: [0.08, 0.2] },
  email: { rotulo: "E-mail", resposta: [0.01, 0.05] },
  linkedin: { rotulo: "LinkedIn", resposta: [0.02, 0.06] },
  multicanal: { rotulo: "Multicanal", resposta: [0.092, 0.23] },
} as const;
export type CanalLP = keyof typeof CANAIS;
export const RESPOSTA_PARA_REUNIAO = [0.2, 0.35] as const;

/** Página pública de contratação: cadastro + pagamento do plano escolhido. */
export function linkAssinar(planoId: string, ciclo: "mensal" | "anual" = "anual"): string {
  const q = new URLSearchParams({ plano: planoId });
  if (ciclo === "mensal") q.set("ciclo", "mensal");
  return `/assinar?${q.toString()}`;
}
