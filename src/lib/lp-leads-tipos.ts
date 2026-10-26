/** Tipos e colunas do quadro de leads da página de vendas (sem dependência de servidor). */

export type EtapaLead = "preencheu" | "teste" | "aguardando_pagamento" | "cliente";
export type ColunaLead = EtapaLead | "em_contato" | "perdido";

export const COLUNAS_LEAD: { id: ColunaLead; nome: string; dica: string }[] = [
  { id: "preencheu", nome: "Preencheu e não concluiu", dica: "Digitou e-mail ou WhatsApp no formulário e saiu sem concluir." },
  { id: "em_contato", nome: "Em contato", dica: "Você já chamou. Arraste para cá quando entrar em contato." },
  { id: "teste", nome: "Teste grátis", dica: "Criou a conta do teste grátis." },
  { id: "aguardando_pagamento", nome: "Aguardando pagamento", dica: "Criou a conta e a assinatura, mas não pagou." },
  { id: "cliente", nome: "Cliente", dica: "Pagamento aprovado." },
  { id: "perdido", nome: "Perdido", dica: "Sem interesse ou contato inválido." },
];

export interface DadosLead {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  pagina?: string | null;
  plano?: string | null;
  ciclo?: string | null;
}

export interface LeadRow extends DadosLead {
  id: string;
  visitante: string | null;
  user_id: string | null;
  etapa: EtapaLead;
  coluna: ColunaLead;
  notas: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  criado_em: string;
  atualizado_em: string;
  movido_em: string;
}
