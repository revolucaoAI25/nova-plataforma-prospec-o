import { z } from "zod";
import type { FlowNodeTipo } from "@/lib/database.types";

/**
 * Registro central de metadados dos tipos de nó do construtor de fluxos.
 * Usado tanto pela paleta da UI (categoria, label, ícone) quanto pela
 * validação da API (schema de config via zod).
 */

export type FlowNodeCategoria = "gatilho" | "extracao" | "enriquecimento" | "disparo" | "destino";

export type LucideIconName =
  | "CalendarClock"
  | "Filter"
  | "Sheet"
  | "FileSpreadsheet"
  | "Play"
  | "Building2"
  | "MapPin"
  | "AtSign"
  | "UserSearch"
  | "History"
  | "BrainCircuit"
  | "Send"
  | "Mail";

// ── Schemas de config por tipo de nó ──────────────────────────────

const gatilhoAgendadoConfigSchema = z.object({
  diasSemana: z.array(z.number().int().min(0).max(6)).min(1),
  horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (HH:MM)"),
});

const gatilhoFiltroLeadsConfigSchema = z.object({
  nicho: z.string().nullable().default(null),
  subnicho: z.string().nullable().default(null),
  uf: z.string().nullable().default(null),
});

const gatilhoPlanilhaConfigSchema = z.object({
  sheetId: z.string().min(1),
  abaNome: z.string().min(1),
  colunaTelefone: z.string().min(1).default("telefone"),
  colunaNome: z.string().nullable().default(null),
});

const gatilhoManualConfigSchema = z.object({}).default({});

const extracaoCnpjConfigSchema = z.object({
  nicho: z.string().min(1),
  subnicho: z.string().nullable().default(null),
  uf: z.string().nullable().default(null),
  cidade: z.string().nullable().default(null),
  cnae: z.string().nullable().default(null),
  porte: z.string().nullable().default(null),
  limite: z.number().int().min(1).max(1000).default(100),
});

const extracaoMapsConfigSchema = z.object({
  nicho: z.string().min(1),
  cidade: z.string().min(1),
  estado: z.string().nullable().default(null),
  limite: z.number().int().min(1).max(500).default(60),
});

const extracaoInstagramConfigSchema = z.object({
  termoBusca: z.string().min(1),
  limite: z.number().int().min(1).max(500).default(60),
});

const extracaoLinkedinConfigSchema = z.object({
  cargos: z.array(z.string().min(1)).default([]),
  localizacoes: z.array(z.string().min(1)).default([]),
  industrias: z.array(z.string().min(1)).default([]),
  palavraChave: z.string().default(""),
  buscarEmail: z.boolean().default(false),
  limite: z.number().int().min(1).max(500).default(100),
});

const fonteHistoricoConfigSchema = z.object({
  searchId: z.string().uuid(),
});

const enriquecimentoIaConfigSchema = z.object({
  nivelRaciocinio: z.enum(["rapido", "equilibrado", "profundo"]).default("equilibrado"),
  buscarSocios: z.boolean().default(false),
  buscarFundacao: z.boolean().default(false),
  buscarProcessos: z.boolean().default(false),
  camposCustomizados: z.array(z.string()).default([]),
});

const disparoWhatsappConfigSchema = z.object({
  campaignId: z.string().uuid().nullable().default(null),
  instanceId: z.string().uuid().nullable().default(null),
});

const disparoEmailConfigSchema = z.object({}).default({});

const destinoSheetsConfigSchema = z.object({
  sheetId: z.string().min(1),
  aba: z.string().min(1),
  modo: z.enum(["substituir", "acrescentar"]).default("acrescentar"),
});

// ── Metadados por tipo ─────────────────────────────────────────────

export interface FlowNodeTypeMeta {
  tipo: FlowNodeTipo;
  categoria: FlowNodeCategoria;
  label: string;
  descricao: string;
  icon: LucideIconName;
  configSchema: z.ZodTypeAny;
  /** Módulo anunciado no roadmap mas sem execução real ainda (falta infra). */
  disponivel: boolean;
}

export const FLOW_NODE_TYPES: Record<FlowNodeTipo, FlowNodeTypeMeta> = {
  gatilho_agendado: {
    tipo: "gatilho_agendado",
    categoria: "gatilho",
    label: "Agendamento",
    descricao: "Inicia o fluxo em dias e horário fixos, como uma automação agendada.",
    icon: "CalendarClock",
    configSchema: gatilhoAgendadoConfigSchema,
    disponivel: true,
  },
  gatilho_filtro_leads: {
    tipo: "gatilho_filtro_leads",
    categoria: "gatilho",
    label: "Novo lead no filtro",
    descricao: "Inicia o fluxo quando surgir um lead novo que combine com o filtro definido.",
    icon: "Filter",
    configSchema: gatilhoFiltroLeadsConfigSchema,
    disponivel: true,
  },
  gatilho_planilha: {
    tipo: "gatilho_planilha",
    categoria: "gatilho",
    label: "Nova linha na planilha",
    descricao: "Inicia o fluxo quando surgir uma linha nova numa planilha Google Sheets monitorada.",
    icon: "Sheet",
    configSchema: gatilhoPlanilhaConfigSchema,
    disponivel: true,
  },
  gatilho_manual: {
    tipo: "gatilho_manual",
    categoria: "gatilho",
    label: "Execução manual",
    descricao: "Inicia o fluxo apenas quando você clicar em \"Executar agora\".",
    icon: "Play",
    configSchema: gatilhoManualConfigSchema,
    disponivel: true,
  },
  extracao_cnpj: {
    tipo: "extracao_cnpj",
    categoria: "extracao",
    label: "Extração CNPJ",
    descricao: "Busca empresas por nicho, CNAE, porte e localização.",
    icon: "Building2",
    configSchema: extracaoCnpjConfigSchema,
    disponivel: true,
  },
  extracao_maps: {
    tipo: "extracao_maps",
    categoria: "extracao",
    label: "Extração Google Maps",
    descricao: "Busca estabelecimentos por nicho e cidade no Google Maps.",
    icon: "MapPin",
    configSchema: extracaoMapsConfigSchema,
    disponivel: true,
  },
  extracao_instagram: {
    tipo: "extracao_instagram",
    categoria: "extracao",
    label: "Extração Instagram",
    descricao: "Busca perfis por termo de busca no Instagram.",
    icon: "AtSign",
    configSchema: extracaoInstagramConfigSchema,
    disponivel: true,
  },
  extracao_linkedin: {
    tipo: "extracao_linkedin",
    categoria: "extracao",
    label: "Extração LinkedIn",
    descricao: "Busca pessoas/decisores por cargo, localização e setor no LinkedIn.",
    icon: "UserSearch",
    configSchema: extracaoLinkedinConfigSchema,
    disponivel: true,
  },
  fonte_historico: {
    tipo: "fonte_historico",
    categoria: "extracao",
    label: "Pesquisa do histórico",
    descricao: "Usa os leads de uma pesquisa já feita como ponto de partida do fluxo, sem nova extração.",
    icon: "History",
    configSchema: fonteHistoricoConfigSchema,
    disponivel: true,
  },
  enriquecimento_ia: {
    tipo: "enriquecimento_ia",
    categoria: "enriquecimento",
    label: "Enriquecimento via IA",
    descricao: "Enriquece os leads recebidos com dados adicionais via IA.",
    icon: "BrainCircuit",
    configSchema: enriquecimentoIaConfigSchema,
    disponivel: true,
  },
  disparo_whatsapp: {
    tipo: "disparo_whatsapp",
    categoria: "disparo",
    label: "Disparo WhatsApp",
    descricao: "Inscreve os leads recebidos numa campanha de disparo por WhatsApp.",
    icon: "Send",
    configSchema: disparoWhatsappConfigSchema,
    disponivel: true,
  },
  disparo_email: {
    tipo: "disparo_email",
    categoria: "disparo",
    label: "Disparo e-mail",
    descricao: "Em breve — envio de e-mail para os leads recebidos.",
    icon: "Mail",
    configSchema: disparoEmailConfigSchema,
    disponivel: false,
  },
  destino_sheets: {
    tipo: "destino_sheets",
    categoria: "destino",
    label: "Exportar para Sheets",
    descricao: "Exporta os leads recebidos para uma planilha Google Sheets.",
    icon: "FileSpreadsheet",
    configSchema: destinoSheetsConfigSchema,
    disponivel: true,
  },
};

export const FLOW_NODE_TYPES_LIST: FlowNodeTypeMeta[] = Object.values(FLOW_NODE_TYPES);

export const FLOW_NODE_CATEGORIAS: { categoria: FlowNodeCategoria; label: string }[] = [
  { categoria: "gatilho", label: "Gatilhos" },
  { categoria: "extracao", label: "Extração" },
  { categoria: "enriquecimento", label: "Enriquecimento" },
  { categoria: "disparo", label: "Disparo" },
  { categoria: "destino", label: "Destino" },
];

export function validarConfigDoNo(tipo: FlowNodeTipo, config: unknown) {
  return FLOW_NODE_TYPES[tipo].configSchema.safeParse(config);
}

const GATILHO_TIPOS_SET = new Set<FlowNodeTipo>(["gatilho_agendado", "gatilho_filtro_leads", "gatilho_planilha", "gatilho_manual"]);

export interface FlowGrafoNode {
  id: string;
  tipo: FlowNodeTipo;
  config: unknown;
}

export interface FlowGrafoEdge {
  id: string;
  from: string;
  to: string;
}

/**
 * Validação estrutural + semântica de um grafo de fluxo, usada tanto na
 * criação quanto na atualização (POST/PATCH /api/flows) — evita salvar um
 * grafo que o motor (flow-engine.ts) não conseguiria executar depois.
 */
export function validarFluxo(nodes: FlowGrafoNode[], edges: FlowGrafoEdge[]): { ok: true } | { ok: false; erro: string } {
  if (!nodes.length) return { ok: false, erro: "O fluxo precisa ter pelo menos um nó." };

  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) return { ok: false, erro: `Id de nó duplicado: ${node.id}.` };
    ids.add(node.id);
    if (!(node.tipo in FLOW_NODE_TYPES)) return { ok: false, erro: `Tipo de nó desconhecido: ${node.tipo}.` };
    const resultado = validarConfigDoNo(node.tipo, node.config);
    if (!resultado.success) {
      return { ok: false, erro: `Configuração inválida no nó '${FLOW_NODE_TYPES[node.tipo].label}': ${resultado.error.issues[0]?.message || "campo inválido"}.` };
    }
  }

  const gatilhos = nodes.filter((n) => GATILHO_TIPOS_SET.has(n.tipo));
  if (gatilhos.length !== 1) return { ok: false, erro: "O fluxo precisa ter exatamente um nó de gatilho." };

  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      return { ok: false, erro: "Uma conexão do fluxo referencia um nó que não existe." };
    }
  }

  const origens = new Set(edges.map((e) => e.from));
  if (origens.size !== edges.length) {
    return { ok: false, erro: "Cada nó só pode ter uma conexão de saída (v1 é um grafo linear)." };
  }

  return { ok: true };
}
