import { z } from "zod";
import type { FlowNodeTipo } from "@/lib/database.types";

/**
 * Registro central de metadados dos tipos de nó do construtor de fluxos.
 * Usado tanto pela paleta da UI (categoria, label, ícone) quanto pela
 * validação da API (schema de config via zod).
 */

export type FlowNodeCategoria = "gatilho" | "extracao" | "enriquecimento" | "controle" | "disparo" | "destino";

export type LucideIconName =
  | "CalendarClock"
  | "Filter"
  | "Sheet"
  | "FileSpreadsheet"
  | "Play"
  | "Building2"
  | "MapPin"
  | "MapPinned"
  | "AtSign"
  | "UserSearch"
  | "History"
  | "BrainCircuit"
  | "SlidersHorizontal"
  | "Hourglass"
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

const variavelEntradaSchema = z.object({
  chave: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/, "Use só letras, números e _ (sem espaços/acentos)."),
  label: z.string().default(""),
  padrao: z.string().default(""),
});
const gatilhoManualConfigSchema = z.object({
  // Parâmetros de entrada do fluxo — preenchidos a cada "Executar agora" e
  // disponíveis nos nós seguintes via {{variaveis.chave}} (ver
  // src/lib/flow/interpolation.ts). Só o gatilho manual tem esse formulário
  // de entrada; os demais gatilhos disparam sem intervenção humana.
  variaveis: z.array(variavelEntradaSchema).default([]),
});
export type VariavelEntrada = z.infer<typeof variavelEntradaSchema>;

// Paridade com o formulário avulso de busca CNPJ (src/components/search/cnpj-search-form.tsx).
const extracaoCnpjConfigSchema = z
  .object({
    cnaes: z.array(z.string()).default([]),
    cnaeManual: z.string().default(""),
    cnaeTipo: z.enum(["principal", "secundario", "ambos"]).default("principal"),
    uf: z.array(z.string()).default([]),
    municipio: z.array(z.string()).default([]),
    porte: z.array(z.string()).default([]),
    matrizFilial: z.enum(["", "MATRIZ", "FILIAL"]).default(""),
    simplesOptante: z.enum(["indiferente", "apenas", "excluir"]).default("indiferente"),
    meiOptante: z.enum(["indiferente", "apenas", "excluir"]).default("indiferente"),
    dataAberturaInicio: z.string().default(""),
    dataAberturaFim: z.string().default(""),
    capitalMin: z.number().nullable().default(null),
    capitalMax: z.number().nullable().default(null),
    comTelefone: z.boolean().default(true),
    comEmail: z.boolean().default(false),
    tipoTelefone: z.enum(["todos", "celular", "fixo"]).default("todos"),
    excluirEmailContab: z.boolean().default(true),
    apenasNovos: z.boolean().default(true),
    recuperacaoJudicial: z.boolean().default(false),
    // Reaproveita o mesmo enriquecimento embutido na busca CNPJ avulsa
    // (enriquecerComMaps) — telefone/site/avaliação extra do Google Maps,
    // opcionalmente filtrando quem não tem perfil lá.
    mapsModo: z.enum(["nao_usar", "enriquecer", "filtrar", "filtrar_enriquecer"]).default("nao_usar"),
    minAvaliacoes: z.number().int().min(0).default(0),
    limite: z.number().int().min(1).max(2000).default(300),
  })
  .refine((v) => v.cnaes.length > 0 || v.cnaeManual.trim().length > 0 || v.recuperacaoJudicial, {
    message: "Selecione ao menos um CNAE (ou ative Recuperação Judicial).",
    path: ["cnaes"],
  })
  .refine((v) => v.uf.length > 0, { message: "Selecione ao menos um estado.", path: ["uf"] });

// Paridade com o formulário avulso de busca Google Maps (src/components/search/maps-search-form.tsx).
const extracaoMapsConfigSchema = z
  .object({
    nicho: z.string().default(""),
    queryCustom: z.string().default(""),
    subnicho: z.string().default(""),
    cidades: z.array(z.string()).default([]),
    estados: z.array(z.string()).default([]),
    showPhone: z.boolean().default(true),
    showRating: z.boolean().default(true),
    apenasNovos: z.boolean().default(true),
    limite: z.number().int().min(1).max(500).default(60),
  })
  .refine((v) => v.cidades.length > 0 || v.estados.length > 0, {
    message: "Informe ao menos uma cidade ou um estado.",
    path: ["estados"],
  })
  .refine((v) => (v.nicho.trim() || v.queryCustom.trim()), {
    message: "Escolha um nicho do catálogo ou informe um termo de busca personalizado.",
    path: ["nicho"],
  });

const extracaoInstagramConfigSchema = z.object({
  tipo: z.enum(["seguidores", "seguindo"]).default("seguidores"),
  termoBusca: z.string().min(1),
  apenasNovos: z.boolean().default(true),
  limite: z.number().int().min(100).max(1000).default(200),
});

const extracaoLinkedinConfigSchema = z.object({
  cargos: z.array(z.string().min(1)).default([]),
  localizacoes: z.array(z.string().min(1)).default([]),
  // IDs numéricos do catálogo LINKEDIN_INDUSTRIES (não texto livre — ver bug
  // corrigido: buscarLinkedIn() faz Number(id) pra montar industryIds).
  industrias: z.array(z.string().min(1)).default([]),
  palavraChave: z.string().default(""),
  buscarEmail: z.boolean().default(false),
  apenasNovos: z.boolean().default(true),
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

const enriquecimentoMapsConfigSchema = z.object({
  showPhone: z.boolean().default(true),
  filtrar: z.boolean().default(false),
  minAvaliacoes: z.number().int().min(0).default(0),
});

const FILTRO_OPERADORES = ["preenchido", "vazio", "contem", "nao_contem", "igual", "diferente"] as const;
const filtroLeadsConfigSchema = z.object({
  campo: z.string().min(1).default("email"),
  operador: z.enum(FILTRO_OPERADORES).default("preenchido"),
  valor: z.string().default(""),
});
export type FiltroOperador = (typeof FILTRO_OPERADORES)[number];
export { FILTRO_OPERADORES };

const esperaConfigSchema = z.object({
  minutos: z.number().int().min(1).max(43_200).default(60),
});

const disparoWhatsappConfigSchema = z.object({
  campaignId: z.string().uuid().nullable().default(null),
  instanceId: z.string().uuid().nullable().default(null),
});

const disparoEmailConfigSchema = z.object({
  campaignId: z.string().uuid().nullable().default(null),
  senderId: z.string().uuid().nullable().default(null),
});

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
    descricao: "Busca empresas por CNAE, porte, situação e localização — mesmos filtros da busca avulsa.",
    icon: "Building2",
    configSchema: extracaoCnpjConfigSchema,
    disponivel: true,
  },
  extracao_maps: {
    tipo: "extracao_maps",
    categoria: "extracao",
    label: "Extração Google Maps",
    descricao: "Busca estabelecimentos por nicho e localidade(s) no Google Maps.",
    icon: "MapPin",
    configSchema: extracaoMapsConfigSchema,
    disponivel: true,
  },
  extracao_instagram: {
    tipo: "extracao_instagram",
    categoria: "extracao",
    label: "Extração Instagram",
    descricao: "Busca seguidores ou seguindo de um perfil no Instagram.",
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
    descricao: "Enriquece os leads recebidos (empresa, cargo, site...) via IA — resultado fica disponível nos nós seguintes.",
    icon: "BrainCircuit",
    configSchema: enriquecimentoIaConfigSchema,
    disponivel: true,
  },
  enriquecimento_maps: {
    tipo: "enriquecimento_maps",
    categoria: "enriquecimento",
    label: "Enriquecimento via Maps",
    descricao: "Cruza os leads recebidos (de qualquer origem) com o Google Maps: telefone, site, avaliação — e opcionalmente filtra quem não tem perfil.",
    icon: "MapPinned",
    configSchema: enriquecimentoMapsConfigSchema,
    disponivel: true,
  },
  filtro_leads: {
    tipo: "filtro_leads",
    categoria: "controle",
    label: "Filtrar leads",
    descricao: "Mantém no fluxo só os leads que batem uma condição (útil depois de um enriquecimento, por exemplo).",
    icon: "SlidersHorizontal",
    configSchema: filtroLeadsConfigSchema,
    disponivel: true,
  },
  espera: {
    tipo: "espera",
    categoria: "controle",
    label: "Esperar",
    descricao: "Pausa o fluxo por um tempo antes de seguir pro próximo nó — útil pra dar espaço entre etapas.",
    icon: "Hourglass",
    configSchema: esperaConfigSchema,
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
    descricao: "Inscreve os leads recebidos numa campanha de disparo por e-mail.",
    icon: "Mail",
    configSchema: disparoEmailConfigSchema,
    disponivel: true,
  },
  destino_sheets: {
    tipo: "destino_sheets",
    categoria: "destino",
    label: "Exportar para Sheets",
    descricao: "Exporta os leads recebidos (com todos os campos, inclusive de enriquecimento) para uma planilha Google Sheets.",
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
  { categoria: "controle", label: "Controle de fluxo" },
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
