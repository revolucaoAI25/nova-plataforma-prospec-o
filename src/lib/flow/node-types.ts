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
  | "ListFilter"
  | "Send"
  | "Mail"
  | "Database"
  | "Kanban";

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
    // Cidades a até X km de cada município (0 = só os municípios) e filtros
    // extras dentro da cidade — ver src/lib/vizinhos.ts.
    raioVizinhosKm: z.number().min(0).max(60).default(0),
    bairro: z.array(z.string()).default([]),
    cep: z.array(z.string()).default([]),
    porte: z.array(z.string()).default([]),
    matrizFilial: z.enum(["", "MATRIZ", "FILIAL"]).default(""),
    simplesOptante: z.enum(["indiferente", "apenas", "excluir"]).default("indiferente"),
    meiOptante: z.enum(["indiferente", "apenas", "excluir"]).default("indiferente"),
    dataAberturaInicio: z.string().default(""),
    dataAberturaFim: z.string().default(""),
    aberturaUltimosDias: z.number().int().min(1).max(3650).nullable().default(null),
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
    // Raio a partir de um endereço (no lugar de cidades/estados) — ver src/lib/raio-maps.ts.
    raioEndereco: z.string().default(""),
    raioKm: z.number().min(1).max(50).default(5),
    raioLat: z.number().nullable().default(null),
    raioLng: z.number().nullable().default(null),
    showPhone: z.boolean().default(true),
    showRating: z.boolean().default(true),
    apenasNovos: z.boolean().default(true),
    limite: z.number().int().min(1).max(500).default(60),
  })
  .refine((v) => v.cidades.length > 0 || v.estados.length > 0 || v.raioEndereco.trim().length >= 3, {
    message: "Informe uma cidade, um estado ou o endereço do raio.",
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

// Opera em qualquer lead do lote que já tenha `cnpj`. Opções do celular do
// sócio (ver src/lib/celular-socio.ts); fluxos antigos sem config caem no
// padrão (só o administrador, só WhatsApp, respeita bloqueio).
const enriquecimentoBigDataCorpConfigSchema = z.object({
  socios: z.enum(["administrador", "todos"]).default("administrador"),
  maxSocios: z.number().int().min(1).max(5).default(2),
  soWhatsapp: z.boolean().default(true),
  respeitarBloqueio: z.boolean().default(true),
});

const FILTRO_OPERADORES = ["preenchido", "vazio", "contem", "nao_contem", "igual", "diferente", "igual_ao_campo", "diferente_do_campo"] as const;
const filtroLeadsConfigSchema = z.object({
  campo: z.string().min(1).default("email"),
  operador: z.enum(FILTRO_OPERADORES).default("preenchido"),
  valor: z.string().default(""),
});
export type FiltroOperador = (typeof FILTRO_OPERADORES)[number];
export { FILTRO_OPERADORES };

const limitarLoteConfigSchema = z.object({
  maximo: z.number().int().min(1).max(100_000).default(50),
  // primeiros = ordem em que chegaram; aleatorio = sorteio; ordenar = pelo campo escolhido.
  modo: z.enum(["primeiros", "aleatorio", "ordenar"]).default("primeiros"),
  campo: z.string().default(""),
  ordem: z.enum(["desc", "asc"]).default("desc"),
});

const esperaConfigSchema = z.object({
  minutos: z.number().int().min(1).max(43_200).default(60),
});

// Quanto tempo depois da última mensagem da cadência o lead sai por "Sem
// resposta" (resposta costuma chegar nas horas seguintes ao último toque).
const horasSemResposta = z.number().int().min(1).max(720).default(48);

const disparoWhatsappConfigSchema = z.object({
  // Sem campanha o executor falha na hora de rodar — melhor barrar antes de ativar.
  campaignId: z.string().uuid().nullable().default(null).refine((v) => v !== null, "Escolha a campanha."),
  instanceId: z.string().uuid().nullable().default(null),
  // Para qual telefone do lead a mensagem vai (ver DESTINOS_TELEFONE em src/lib/phone.ts).
  telefoneDestino: z.enum(["padrao", "socio", "empresa", "segundo"]).default("padrao"),
  horasSemResposta,
});

const disparoEmailConfigSchema = z.object({
  // Sem campanha o executor falha na hora de rodar — melhor barrar antes de ativar.
  campaignId: z.string().uuid().nullable().default(null).refine((v) => v !== null, "Escolha a campanha."),
  senderId: z.string().uuid().nullable().default(null),
  horasSemResposta,
});

const disparoLinkedinConfigSchema = z.object({
  // Sem campanha o executor falha na hora de rodar — melhor barrar antes de ativar.
  campaignId: z.string().uuid().nullable().default(null).refine((v) => v !== null, "Escolha a campanha."),
  accountId: z.string().uuid().nullable().default(null),
  horasSemResposta,
});

const destinoSheetsConfigSchema = z.object({
  sheetId: z.string().min(1),
  aba: z.string().min(1),
  modo: z.enum(["substituir", "acrescentar"]).default("acrescentar"),
});

const destinoFunilConfigSchema = z.object({
  funilId: z.string().uuid(),
  colunaId: z.string().uuid(),
});

// ── Metadados por tipo ─────────────────────────────────────────────

/**
 * Saída extra de um nó (além da principal). `imediata`: o executor já
 * separa esses leads na hora (ex.: quem não atende o filtro). `resultado`:
 * os leads saem depois, conforme a campanha de disparo anda (ver
 * src/lib/flow/saidas-disparo.ts) — pode levar dias.
 */
export interface SaidaDoNo {
  id: string;
  label: string;
  descricao: string;
  quando: "imediata" | "resultado";
  tom: "sucesso" | "erro" | "info" | "neutro";
}

export interface FlowNodeTypeMeta {
  tipo: FlowNodeTipo;
  categoria: FlowNodeCategoria;
  label: string;
  descricao: string;
  icon: LucideIconName;
  configSchema: z.ZodTypeAny;
  /** Módulo anunciado no roadmap mas sem execução real ainda (falta infra). */
  disponivel: boolean;
  /** Nome da saída principal quando o nó tem saídas extras (ex.: "Atende"). */
  rotuloSaidaPrincipal?: string;
  saidas?: SaidaDoNo[];
}

export const SAIDAS_DISPARO: SaidaDoNo[] = [
  { id: "enviou", label: "Enviou", descricao: "A primeira mensagem saiu para o lead.", quando: "resultado", tom: "sucesso" },
  { id: "falhou", label: "Falhou", descricao: "Não deu para enviar: contato inválido ou o envio deu erro antes da primeira mensagem.", quando: "resultado", tom: "erro" },
  { id: "respondeu", label: "Respondeu", descricao: "O lead respondeu em algum momento da cadência.", quando: "resultado", tom: "info" },
  { id: "sem_resposta", label: "Sem resposta", descricao: "A cadência terminou e o lead não respondeu no prazo definido.", quando: "resultado", tom: "neutro" },
];

const SAIDAS_SOCIOS: SaidaDoNo[] = [
  {
    id: "sem_celular",
    label: "Sem celular",
    descricao: "Leads em que não achamos o celular do sócio (ou sem CNPJ). Sem nada ligado aqui, eles seguem pelo caminho principal com o telefone da empresa.",
    quando: "imediata",
    tom: "neutro",
  },
];

const SAIDAS_FILTRO: SaidaDoNo[] = [
  { id: "nao_atende", label: "Não atende", descricao: "Leads que não batem a condição seguem por aqui em vez de serem descartados.", quando: "imediata", tom: "neutro" },
];

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
  enriquecimento_bigdatacorp: {
    tipo: "enriquecimento_bigdatacorp",
    categoria: "enriquecimento",
    label: "Celular do sócio",
    descricao: "Acha o celular pessoal (com WhatsApp) do sócio de cada lead com CNPJ. Quem não tem celular encontrado pode seguir por outro caminho.",
    icon: "Database",
    configSchema: enriquecimentoBigDataCorpConfigSchema,
    disponivel: true,
    rotuloSaidaPrincipal: "Achou celular",
    saidas: SAIDAS_SOCIOS,
  },
  filtro_leads: {
    tipo: "filtro_leads",
    categoria: "controle",
    label: "Filtrar leads",
    descricao: "Separa os leads por uma condição: quem atende segue em frente e quem não atende pode ir por outro caminho.",
    icon: "SlidersHorizontal",
    configSchema: filtroLeadsConfigSchema,
    disponivel: true,
    rotuloSaidaPrincipal: "Atende",
    saidas: SAIDAS_FILTRO,
  },
  limitar_lote: {
    tipo: "limitar_lote",
    categoria: "controle",
    label: "Limitar lote",
    descricao: "Deixa seguir no máximo N leads por execução (os primeiros, sorteados ou os melhores por um campo).",
    icon: "ListFilter",
    configSchema: limitarLoteConfigSchema,
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
    rotuloSaidaPrincipal: "Em seguida",
    saidas: SAIDAS_DISPARO,
  },
  disparo_email: {
    tipo: "disparo_email",
    categoria: "disparo",
    label: "Disparo e-mail",
    descricao: "Inscreve os leads recebidos numa campanha de disparo por e-mail.",
    icon: "Mail",
    configSchema: disparoEmailConfigSchema,
    disponivel: true,
    rotuloSaidaPrincipal: "Em seguida",
    saidas: SAIDAS_DISPARO,
  },
  disparo_linkedin: {
    tipo: "disparo_linkedin",
    categoria: "disparo",
    label: "Disparo LinkedIn",
    descricao: "Inscreve os leads recebidos numa campanha de pedido de conexão/mensagem por LinkedIn.",
    icon: "UserSearch",
    configSchema: disparoLinkedinConfigSchema,
    disponivel: true,
    rotuloSaidaPrincipal: "Em seguida",
    saidas: SAIDAS_DISPARO,
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
  destino_funil: {
    tipo: "destino_funil",
    categoria: "destino",
    label: "Adicionar ao Funil",
    descricao: "Deposita os leads recebidos numa coluna de um Funil (Kanban) — não dispara o fluxo configurado naquela coluna (só o arraste manual dispara, evita loop).",
    icon: "Kanban",
    configSchema: destinoFunilConfigSchema,
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
  saida?: string | null;
}

/** Saídas que um tipo de nó aceita: "" é a principal. */
export function saidasValidas(tipo: FlowNodeTipo): string[] {
  return ["", ...(FLOW_NODE_TYPES[tipo]?.saidas ?? []).map((s) => s.id)];
}

function temCiclo(nodes: FlowGrafoNode[], edges: FlowGrafoEdge[]): boolean {
  const saindo = new Map<string, string[]>();
  for (const e of edges) saindo.set(e.from, [...(saindo.get(e.from) ?? []), e.to]);
  const estado = new Map<string, 1 | 2>(); // 1 = visitando, 2 = pronto
  const visitar = (id: string): boolean => {
    if (estado.get(id) === 1) return true;
    if (estado.get(id) === 2) return false;
    estado.set(id, 1);
    for (const prox of saindo.get(id) ?? []) if (visitar(prox)) return true;
    estado.set(id, 2);
    return false;
  };
  return nodes.some((n) => visitar(n.id));
}

/**
 * Validação estrutural: o grafo não está corrompido (ids únicos, tipos
 * conhecidos, conexões apontando pra nós que existem, no máximo uma
 * conexão por saída de cada nó, sem loop). Vale pra qualquer gravação —
 * inclusive rascunho.
 */
export function validarEstruturaFluxo(nodes: FlowGrafoNode[], edges: FlowGrafoEdge[]): { ok: true } | { ok: false; erro: string } {
  if (!nodes.length) return { ok: false, erro: "O fluxo precisa ter pelo menos um nó." };

  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) return { ok: false, erro: `Id de nó duplicado: ${node.id}.` };
    ids.add(node.id);
    if (!(node.tipo in FLOW_NODE_TYPES)) return { ok: false, erro: `Tipo de nó desconhecido: ${node.tipo}.` };
  }

  const tipoPorId = new Map(nodes.map((n) => [n.id, n.tipo]));
  const origens = new Set<string>();
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      return { ok: false, erro: "Uma conexão do fluxo referencia um nó que não existe." };
    }
    if (edge.from === edge.to) return { ok: false, erro: "Um nó não pode se conectar a ele mesmo." };
    const saida = edge.saida || "";
    if (!saidasValidas(tipoPorId.get(edge.from)!).includes(saida)) {
      return { ok: false, erro: `Saída desconhecida '${saida}' no nó ${FLOW_NODE_TYPES[tipoPorId.get(edge.from)!].label}.` };
    }
    const chave = `${edge.from}|${saida}`;
    if (origens.has(chave)) {
      return { ok: false, erro: "Cada saída de um nó só pode ter uma conexão." };
    }
    origens.add(chave);
  }

  if (temCiclo(nodes, edges)) return { ok: false, erro: "O fluxo tem um caminho que volta para um passo anterior (loop)." };

  return { ok: true };
}

/**
 * Validação completa — estrutura + config de cada nó + gatilho único. Exigida
 * pra ATIVAR ou executar um fluxo: garante que o motor (flow-engine.ts)
 * consegue rodá-lo. Rascunhos pausados só precisam da estrutural.
 */
export function validarFluxo(nodes: FlowGrafoNode[], edges: FlowGrafoEdge[]): { ok: true } | { ok: false; erro: string } {
  const estrutura = validarEstruturaFluxo(nodes, edges);
  if (!estrutura.ok) return estrutura;

  for (const node of nodes) {
    const resultado = validarConfigDoNo(node.tipo, node.config);
    if (!resultado.success) {
      return { ok: false, erro: `Configuração inválida no nó '${FLOW_NODE_TYPES[node.tipo].label}': ${(resultado.error.issues[0]?.message || "campo inválido").replace(/\.$/, "")}.` };
    }
  }

  const gatilhos = nodes.filter((n) => GATILHO_TIPOS_SET.has(n.tipo));
  if (gatilhos.length !== 1) return { ok: false, erro: "O fluxo precisa ter exatamente um nó de gatilho." };

  return { ok: true };
}
