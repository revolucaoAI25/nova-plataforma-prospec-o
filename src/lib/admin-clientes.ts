import type { AssinaturaCiclo, AssinaturaStatus, PlanRow } from "@/lib/database.types";
import { planoNaCondicao, type CondicaoPreco } from "@/lib/condicao-preco";

/** Colunas de profiles que a área de admin usa para a situação de cada cliente (sem segredos). */
export interface ClienteAdmin {
  id: string;
  role: "user" | "admin";
  plano_id: string | null;
  assinatura_status: AssinaturaStatus;
  assinatura_ciclo: AssinaturaCiclo;
  teste_gratis: boolean;
  teste_expira_em: string | null;
  conta_teste: boolean;
  acesso_ate?: string | null;
  condicao_preco?: CondicaoPreco | null;
}

export type FiltroSituacao = "assinante" | "teste" | "atencao" | "sem_plano" | "interno";

export interface Situacao {
  rotulo: string;
  tom: "sucesso" | "alerta" | "perigo" | "neutro" | "info";
  filtro: FiltroSituacao;
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** Em que pé está o cliente: assinante, teste, pagamento atrasado etc. */
export function situacaoCliente(c: ClienteAdmin, nomePlano?: string | null, agora = new Date()): Situacao {
  if (c.role === "admin") return { rotulo: "Admin", tom: "neutro", filtro: "interno" };
  if (c.conta_teste) return { rotulo: "Conta de teste", tom: "neutro", filtro: "interno" };
  switch (c.assinatura_status) {
    case "ativa":
      return { rotulo: nomePlano ? `Assinante · ${nomePlano}` : "Assinante", tom: "sucesso", filtro: "assinante" };
    case "inadimplente":
      return { rotulo: "Pagamento atrasado", tom: "perigo", filtro: "atencao" };
    case "pendente":
      return { rotulo: "Aguardando pagamento", tom: "alerta", filtro: "atencao" };
    case "cancelada":
      return c.acesso_ate && new Date(c.acesso_ate) > agora
        ? { rotulo: `Cancelou · acesso até ${dataCurta(c.acesso_ate)}`, tom: "alerta", filtro: "atencao" }
        : { rotulo: "Cancelou", tom: "neutro", filtro: "sem_plano" };
  }
  if (c.teste_gratis) {
    return c.teste_expira_em && new Date(c.teste_expira_em) <= agora
      ? { rotulo: "Teste encerrado", tom: "alerta", filtro: "teste" }
      : { rotulo: c.teste_expira_em ? `Em teste até ${dataCurta(c.teste_expira_em)}` : "Em teste", tom: "info", filtro: "teste" };
  }
  return { rotulo: "Sem plano", tom: "neutro", filtro: "sem_plano" };
}

/** Receita mensal da assinatura do cliente (anual dividido por 12), pela tabela ou pela condição travada dele. */
export function receitaMensalCentavos(c: ClienteAdmin, planos: Map<string, PlanRow>): number {
  if (c.role === "admin" || c.conta_teste || c.assinatura_status !== "ativa" || !c.plano_id) return 0;
  const base = planos.get(c.plano_id);
  if (!base) return 0;
  const plano = planoNaCondicao(base, c.condicao_preco);
  return c.assinatura_ciclo === "anual" ? Math.round((plano.preco_anual_centavos ?? plano.preco_centavos * 12) / 12) : plano.preco_centavos;
}

export const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: centavos % 100 ? 2 : 0 });
