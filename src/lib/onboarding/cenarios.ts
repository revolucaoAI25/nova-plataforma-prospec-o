import { z } from "zod";
import type { AcaoCredito, FlowEdge, FlowNode, FlowNodeTipo, Json, PlanFeatureFlags } from "@/lib/database.types";
import { CODIGO_PARA_DESC } from "@/lib/data/cnaes";
import { NICHOS } from "@/lib/data/nichos";
import { SIGLAS_ESTADOS } from "@/lib/data/estados";
import { LINKEDIN_INDUSTRIES } from "@/lib/data/linkedin-industries";

// Mapa de cenários de prospecção — o "cardápio" fechado de onde a IA do
// onboarding monta os planos A, B, C… de cada cliente. A IA NÃO desenha
// fluxos livremente: ela escolhe um cenário, preenche os parâmetros
// (ParametrosCenario) e escreve as mensagens; quem transforma isso em nós
// de fluxo é `montar()`, aqui, com configs que passam pelos mesmos schemas
// do construtor. Assim nenhum preset nasce quebrado, e o custo de cada
// plano é calculável antes de o cliente dar play (ver estimativa.ts).

export type CanalDisparo = "whatsapp" | "email" | "linkedin";
export type FonteCenario = "cnpj" | "maps" | "linkedin" | "instagram" | "base_propria";

export const CENARIO_IDS = [
  "cnpj_whatsapp",
  "cnpj_decisor_whatsapp",
  "cnpj_email",
  "cnpj_decisor_email",
  "cnpj_multicanal",
  "cnpj_presenca_google",
  "cnpj_recem_abertas",
  "cnpj_recuperacao_judicial",
  "maps_whatsapp",
  "maps_ia_whatsapp",
  "linkedin_conexao",
  "linkedin_email",
  "linkedin_ia_abm",
  "instagram_audiencia",
  "base_reativacao",
  "base_enriquecida",
  "lista_time_comercial",
] as const;
export type CenarioId = (typeof CENARIO_IDS)[number];

// Formato estrito (todos os campos presentes, "vazio" = null/[]) porque é
// o que a IA devolve via structured output. Limites e validação de valores
// ficam em normalizarParametros — o schema só garante o formato.
export const parametrosCenarioSchema = z.object({
  cnaes: z.array(z.string()),
  ufs: z.array(z.string()),
  cidades: z.array(z.string()),
  portes: z.array(z.enum(["01", "03", "05"])),
  simples: z.enum(["indiferente", "apenas", "excluir"]),
  mei: z.enum(["indiferente", "apenas", "excluir"]),
  aberturaUltimosDias: z.number().nullable(),
  capitalMinimo: z.number().nullable(),
  nichoMaps: z.string().nullable(),
  termoMaps: z.string().nullable(),
  minAvaliacoes: z.number().nullable(),
  cargosLinkedin: z.array(z.string()),
  industriasLinkedin: z.array(z.string()),
  localizacoesLinkedin: z.array(z.string()),
  palavraChaveLinkedin: z.string().nullable(),
  perfilInstagram: z.string().nullable(),
  camposIa: z.array(z.string()),
  leadsPorExecucao: z.number(),
  diasSemana: z.array(z.number()),
  horario: z.string(),
});
export type ParametrosCenario = z.infer<typeof parametrosCenarioSchema>;

export interface AlvosMontagem {
  funilId: string;
  colunaId: string;
  campanhas: Partial<Record<CanalDisparo, string>>;
}

type Recurso = keyof PlanFeatureFlags;

export interface Cenario {
  id: CenarioId;
  nome: string;
  resumo: string;
  fonte: FonteCenario;
  canais: CanalDisparo[];
  /** Ações cobradas em crédito por lead que passa pelo fluxo. */
  acoesPorLead: AcaoCredito[];
  usaOpenai: boolean;
  recursos: Recurso[];
  idealPara: string[];
  evitarQuando: string[];
  /** Variáveis {{…}} que existem no lead quando a mensagem é enviada. */
  variaveis: string[];
  /** Etapas em linguagem de cliente, pra UI ("Toda manhã → busca CNPJ → …"). */
  etapas: string[];
  /** Teto de leads por execução da fonte (limite do próprio nó). */
  tetoPorExecucao: number;
  montar(p: ParametrosCenario, alvos: AlvosMontagem): { nodes: FlowNode[]; edges: FlowEdge[] };
}

// ── Blocos de montagem ─────────────────────────────────────────────

interface Passo {
  tipo: FlowNodeTipo;
  config: Record<string, unknown>;
}

function cadeia(passos: Passo[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = passos.map((p, i) => ({
    id: crypto.randomUUID(),
    tipo: p.tipo,
    config: p.config as Json,
    posicao: { x: 60 + i * 300, y: 160 },
  }));
  const edges: FlowEdge[] = nodes.slice(1).map((n, i) => ({ id: crypto.randomUUID(), from: nodes[i].id, to: n.id }));
  return { nodes, edges };
}

const agendado = (p: ParametrosCenario): Passo => ({
  tipo: "gatilho_agendado",
  config: { diasSemana: p.diasSemana, horario: p.horario },
});

const planilha = (): Passo => ({
  tipo: "gatilho_planilha",
  // Planilha/aba são escolhidas pelo cliente no passo a passo — o fluxo
  // fica pausado até lá.
  config: { sheetId: "", abaNome: "", colunaTelefone: "telefone", colunaNome: "nome" },
});

function cnpj(p: ParametrosCenario, extra: Record<string, unknown> = {}): Passo {
  const doCatalogo = p.cnaes.filter((c) => c in CODIGO_PARA_DESC);
  const manuais = p.cnaes.filter((c) => !(c in CODIGO_PARA_DESC));
  return {
    tipo: "extracao_cnpj",
    config: {
      cnaes: doCatalogo,
      cnaeManual: manuais.join(", "),
      cnaeTipo: "principal",
      uf: p.ufs.length ? p.ufs : SIGLAS_ESTADOS,
      municipio: p.cidades,
      porte: p.portes,
      matrizFilial: "",
      simplesOptante: p.simples,
      meiOptante: p.mei,
      dataAberturaInicio: "",
      dataAberturaFim: "",
      aberturaUltimosDias: p.aberturaUltimosDias,
      capitalMin: p.capitalMinimo,
      capitalMax: null,
      comTelefone: true,
      comEmail: false,
      tipoTelefone: "celular",
      excluirEmailContab: true,
      apenasNovos: true,
      recuperacaoJudicial: false,
      mapsModo: "nao_usar",
      minAvaliacoes: 0,
      limite: Math.min(p.leadsPorExecucao, 2000),
      ...extra,
    },
  };
}

function maps(p: ParametrosCenario): Passo {
  const nichoValido = p.nichoMaps && p.nichoMaps in NICHOS ? p.nichoMaps : "";
  // A extração Maps só aceita cidades junto com exatamente um estado.
  const cidades = p.ufs.length === 1 ? p.cidades : [];
  return {
    tipo: "extracao_maps",
    config: {
      nicho: nichoValido,
      queryCustom: nichoValido ? "" : p.termoMaps || "",
      subnicho: "",
      cidades,
      estados: p.ufs,
      showPhone: true,
      showRating: true,
      apenasNovos: true,
      limite: Math.min(p.leadsPorExecucao, 500),
    },
  };
}

function linkedin(p: ParametrosCenario, buscarEmail: boolean): Passo {
  return {
    tipo: "extracao_linkedin",
    config: {
      cargos: p.cargosLinkedin,
      localizacoes: p.localizacoesLinkedin,
      industrias: p.industriasLinkedin,
      palavraChave: p.palavraChaveLinkedin || "",
      buscarEmail,
      apenasNovos: true,
      limite: Math.min(p.leadsPorExecucao, 500),
    },
  };
}

const instagram = (p: ParametrosCenario): Passo => ({
  tipo: "extracao_instagram",
  config: {
    tipo: "seguidores",
    termoBusca: p.perfilInstagram || "",
    apenasNovos: true,
    limite: Math.max(100, Math.min(p.leadsPorExecucao, 1000)),
  },
});

const socios: Passo = { tipo: "enriquecimento_bigdatacorp", config: {} };

const ia = (p: ParametrosCenario): Passo => ({
  tipo: "enriquecimento_ia",
  config: {
    nivelRaciocinio: "equilibrado",
    buscarSocios: false,
    buscarFundacao: false,
    buscarProcessos: false,
    camposCustomizados: p.camposIa,
  },
});

const exigir = (campo: "telefone" | "email"): Passo => ({
  tipo: "filtro_leads",
  config: { campo, operador: "preenchido", valor: "" },
});

const funil = (a: AlvosMontagem): Passo => ({
  tipo: "destino_funil",
  config: { funilId: a.funilId, colunaId: a.colunaId },
});

const whatsapp = (a: AlvosMontagem): Passo => ({
  tipo: "disparo_whatsapp",
  config: { campaignId: a.campanhas.whatsapp ?? null, instanceId: null },
});

const email = (a: AlvosMontagem): Passo => ({
  tipo: "disparo_email",
  config: { campaignId: a.campanhas.email ?? null, senderId: null },
});

const linkedinDisparo = (a: AlvosMontagem): Passo => ({
  tipo: "disparo_linkedin",
  config: { campaignId: a.campanhas.linkedin ?? null, accountId: null },
});

const VARS_CNPJ = ["nome", "municipio", "uf", "socio_principal", "porte"];
const VARS_SOCIOS = [...VARS_CNPJ, "bigdatacorp_socio_nome", "bigdatacorp_razao_social"];
const VARS_MAPS = ["nome", "municipio", "uf", "avaliacao", "site"];
const VARS_LINKEDIN = ["nome", "cargo", "empresa_atual", "municipio"];
const VARS_IA = ["enriquecimento_resumo", "enriquecimento_empresa", "enriquecimento_extra_<campo>"];

// ── Catálogo ───────────────────────────────────────────────────────

export const CENARIOS: Record<CenarioId, Cenario> = {
  cnpj_whatsapp: {
    id: "cnpj_whatsapp",
    nome: "Base de CNPJ segmentada → WhatsApp",
    resumo: "Empresas do seu segmento e região, com celular, abordadas direto no WhatsApp.",
    fonte: "cnpj",
    canais: ["whatsapp"],
    acoesPorLead: ["cnpj"],
    usaOpenai: false,
    recursos: ["disparo_habilitado"],
    idealPara: [
      "PMEs definidas por CNAE, onde o próprio dono costuma atender o celular",
      "ticket baixo a médio e volume alto — é o cenário mais barato por lead (1 crédito)",
      "quem está começando e quer resultado rápido com pouco crédito",
    ],
    evitarQuando: [
      "precisa falar com um cargo específico em empresa média/grande (use LinkedIn)",
      "ticket alto, onde um contato errado queima a oportunidade (use cnpj_decisor_whatsapp)",
      "o cliente não tem número de WhatsApp dedicado",
    ],
    variaveis: VARS_CNPJ,
    etapas: ["Agendamento", "Busca de empresas por CNAE", "Funil", "WhatsApp"],
    tetoPorExecucao: 2000,
    montar: (p, a) => cadeia([agendado(p), cnpj(p), funil(a), whatsapp(a)]),
  },
  cnpj_decisor_whatsapp: {
    id: "cnpj_decisor_whatsapp",
    nome: "CNPJ + sócio e contato validado → WhatsApp",
    resumo: "Mesma base de CNPJ, mas com o sócio identificado e um telefone validado antes de abordar.",
    fonte: "cnpj",
    canais: ["whatsapp"],
    acoesPorLead: ["cnpj", "bigdatacorp"],
    usaOpenai: false,
    recursos: ["disparo_habilitado", "bigdatacorp_enrichment_habilitado"],
    idealPara: [
      "ticket médio/alto em que quem decide é o dono ou sócio",
      "mensagem que chama o sócio pelo nome — taxa de resposta bem maior",
      "segmentos em que o telefone da base pública costuma estar desatualizado",
    ],
    evitarQuando: [
      "orçamento de créditos apertado com volume alto (~41 créditos/lead)",
      "negócios locais achados melhor pelo Google Maps",
    ],
    variaveis: VARS_SOCIOS,
    etapas: ["Agendamento", "Busca de empresas por CNAE", "Sócios e contato validado", "Só quem tem telefone", "Funil", "WhatsApp"],
    tetoPorExecucao: 2000,
    montar: (p, a) => cadeia([agendado(p), cnpj(p, { comTelefone: false, tipoTelefone: "todos" }), socios, exigir("telefone"), funil(a), whatsapp(a)]),
  },
  cnpj_email: {
    id: "cnpj_email",
    nome: "Base de CNPJ → cadência de e-mail",
    resumo: "Empresas do segmento com e-mail cadastrado, numa sequência de e-mails.",
    fonte: "cnpj",
    canais: ["email"],
    acoesPorLead: ["cnpj"],
    usaOpenai: false,
    recursos: ["email_disparo_habilitado"],
    idealPara: [
      "quem não tem (ou não quer arriscar) um número de WhatsApp dedicado",
      "B2B com ciclo de venda mais longo, em que e-mail é canal natural",
      "volume alto com custo mínimo (1 crédito/lead)",
    ],
    evitarQuando: [
      "MEI e negócios muito pequenos, que quase não leem e-mail",
      "cliente sem domínio de e-mail próprio",
    ],
    variaveis: VARS_CNPJ,
    etapas: ["Agendamento", "Busca de empresas com e-mail", "Funil", "Sequência de e-mails"],
    tetoPorExecucao: 2000,
    montar: (p, a) =>
      cadeia([agendado(p), cnpj(p, { comTelefone: false, comEmail: true, tipoTelefone: "todos" }), funil(a), email(a)]),
  },
  cnpj_decisor_email: {
    id: "cnpj_decisor_email",
    nome: "CNPJ + sócio e contato validado → e-mail",
    resumo: "E-mail validado do sócio/empresa antes de entrar na sequência.",
    fonte: "cnpj",
    canais: ["email"],
    acoesPorLead: ["cnpj", "bigdatacorp"],
    usaOpenai: false,
    recursos: ["email_disparo_habilitado", "bigdatacorp_enrichment_habilitado"],
    idealPara: [
      "venda consultiva B2B de ticket alto, com abordagem mais formal",
      "quando e-mail genérico (contato@, contabilidade) derruba a entrega",
    ],
    evitarQuando: ["orçamento apertado", "público de MEI/pequeno comércio"],
    variaveis: VARS_SOCIOS,
    etapas: ["Agendamento", "Busca de empresas por CNAE", "Sócios e contato validado", "Só quem tem e-mail", "Funil", "Sequência de e-mails"],
    tetoPorExecucao: 2000,
    montar: (p, a) => cadeia([agendado(p), cnpj(p, { comTelefone: false, tipoTelefone: "todos" }), socios, exigir("email"), funil(a), email(a)]),
  },
  cnpj_multicanal: {
    id: "cnpj_multicanal",
    nome: "CNPJ + sócio validado → WhatsApp e e-mail",
    resumo: "O mesmo lead recebe WhatsApp e, alguns dias depois, e-mail — máxima chance de contato.",
    fonte: "cnpj",
    canais: ["whatsapp", "email"],
    acoesPorLead: ["cnpj", "bigdatacorp"],
    usaOpenai: false,
    recursos: ["disparo_habilitado", "email_disparo_habilitado", "bigdatacorp_enrichment_habilitado"],
    idealPara: [
      "ticket alto em que cada lead vale muito e vale insistir em dois canais",
      "cliente que já tem WhatsApp dedicado e domínio de e-mail",
    ],
    evitarQuando: ["volume alto com pouco crédito", "time pequeno que não dá conta de dois canais"],
    variaveis: VARS_SOCIOS,
    etapas: ["Agendamento", "Busca de empresas por CNAE", "Sócios e contato validado", "Só quem tem telefone", "Funil", "WhatsApp", "E-mail"],
    tetoPorExecucao: 2000,
    montar: (p, a) =>
      cadeia([agendado(p), cnpj(p, { comTelefone: false, tipoTelefone: "todos" }), socios, exigir("telefone"), funil(a), whatsapp(a), email(a)]),
  },
  cnpj_presenca_google: {
    id: "cnpj_presenca_google",
    nome: "CNPJ com presença ativa no Google → WhatsApp",
    resumo: "Filtros de CNPJ (porte, idade, capital) + só quem está ativo e avaliado no Google.",
    fonte: "cnpj",
    canais: ["whatsapp"],
    acoesPorLead: ["cnpj", "cnpj_maps_extra"],
    usaOpenai: false,
    recursos: ["disparo_habilitado"],
    idealPara: [
      "precisa dos filtros de CNPJ E só quer empresas que estão de portas abertas",
      "o sinal de compra é 'bem avaliada no Google'",
    ],
    evitarQuando: [
      "o nicho dá pra buscar direto no Google Maps — maps_whatsapp sai ~10x mais barato",
      "orçamento apertado (~56 créditos/lead)",
    ],
    variaveis: [...VARS_CNPJ, "avaliacao", "site"],
    etapas: ["Agendamento", "Busca de empresas por CNAE", "Filtro de presença no Google", "Funil", "WhatsApp"],
    tetoPorExecucao: 2000,
    montar: (p, a) =>
      cadeia([agendado(p), cnpj(p, { mapsModo: "filtrar_enriquecer", minAvaliacoes: p.minAvaliacoes ?? 5 }), funil(a), whatsapp(a)]),
  },
  cnpj_recem_abertas: {
    id: "cnpj_recem_abertas",
    nome: "Empresas recém-abertas → WhatsApp",
    resumo: "Toda manhã, as empresas abertas nos últimos dias no seu segmento e região.",
    fonte: "cnpj",
    canais: ["whatsapp"],
    acoesPorLead: ["cnpj"],
    usaOpenai: false,
    recursos: ["disparo_habilitado"],
    idealPara: [
      "quem vende pra empresa nova: contabilidade, banco/maquininha, sistema de gestão, marketing, seguro, certificado digital",
      "abordagem no momento certo — a empresa acabou de abrir e ainda está montando fornecedores",
    ],
    evitarQuando: ["o produto só serve pra empresa madura/grande"],
    variaveis: VARS_CNPJ,
    etapas: ["Todo dia", "Empresas abertas nos últimos dias", "Funil", "WhatsApp"],
    tetoPorExecucao: 2000,
    montar: (p, a) => cadeia([agendado(p), cnpj(p, { aberturaUltimosDias: p.aberturaUltimosDias ?? 30 }), funil(a), whatsapp(a)]),
  },
  cnpj_recuperacao_judicial: {
    id: "cnpj_recuperacao_judicial",
    nome: "Empresas em recuperação judicial → e-mail",
    resumo: "Empresas em recuperação judicial, com sócio identificado, em abordagem formal por e-mail.",
    fonte: "cnpj",
    canais: ["email"],
    acoesPorLead: ["cnpj", "bigdatacorp"],
    usaOpenai: false,
    recursos: ["email_disparo_habilitado", "bigdatacorp_enrichment_habilitado"],
    idealPara: ["advocacia empresarial, consultoria financeira/reestruturação, compra de ativos"],
    evitarQuando: ["qualquer oferta que não tenha a ver com reestruturação — o assunto é sensível"],
    variaveis: VARS_SOCIOS,
    etapas: ["Semanal", "Empresas em recuperação judicial", "Sócios e contato validado", "Só quem tem e-mail", "Funil", "Sequência de e-mails"],
    tetoPorExecucao: 2000,
    montar: (p, a) =>
      cadeia([agendado(p), cnpj(p, { recuperacaoJudicial: true, comTelefone: false, tipoTelefone: "todos" }), socios, exigir("email"), funil(a), email(a)]),
  },
  maps_whatsapp: {
    id: "maps_whatsapp",
    nome: "Negócios locais no Google Maps → WhatsApp",
    resumo: "Estabelecimentos do nicho na sua cidade, com o telefone que eles mesmos publicam.",
    fonte: "maps",
    canais: ["whatsapp"],
    acoesPorLead: ["maps"],
    usaOpenai: false,
    recursos: ["disparo_habilitado"],
    idealPara: [
      "negócios locais e profissionais liberais com endereço (clínicas, consultórios, restaurantes, academias, salões, imobiliárias)",
      "o telefone do Maps costuma ser o comercial — muitas vezes o próprio WhatsApp do negócio",
      "atendimento em cidades específicas",
    ],
    evitarQuando: [
      "precisa filtrar por porte, capital ou idade da empresa (use CNPJ)",
      "o público não tem ponto físico",
    ],
    variaveis: VARS_MAPS,
    etapas: ["Agendamento", "Busca no Google Maps", "Funil", "WhatsApp"],
    tetoPorExecucao: 500,
    montar: (p, a) => cadeia([agendado(p), maps(p), funil(a), whatsapp(a)]),
  },
  maps_ia_whatsapp: {
    id: "maps_ia_whatsapp",
    nome: "Negócios locais + pesquisa por IA → WhatsApp personalizado",
    resumo: "A IA pesquisa cada negócio e a primeira mensagem cita algo específico dele.",
    fonte: "maps",
    canais: ["whatsapp"],
    acoesPorLead: ["maps"],
    usaOpenai: true,
    recursos: ["disparo_habilitado", "enriquecimento_ia_habilitado"],
    idealPara: [
      "ticket médio/alto em negócio local, em que personalização faz diferença",
      "volume baixo a médio — cada lead passa por pesquisa",
      "cliente com conta na OpenAI",
    ],
    evitarQuando: ["volume alto", "cliente sem chave OpenAI"],
    variaveis: [...VARS_MAPS, ...VARS_IA],
    etapas: ["Agendamento", "Busca no Google Maps", "Pesquisa por IA", "Funil", "WhatsApp personalizado"],
    tetoPorExecucao: 500,
    montar: (p, a) => cadeia([agendado(p), maps(p), ia(p), funil(a), whatsapp(a)]),
  },
  linkedin_conexao: {
    id: "linkedin_conexao",
    nome: "Decisores no LinkedIn → convite + mensagem",
    resumo: "Pessoas no cargo certo recebem um convite com nota e, ao aceitar, uma mensagem.",
    fonte: "linkedin",
    canais: ["linkedin"],
    acoesPorLead: ["linkedin"],
    usaOpenai: false,
    recursos: ["linkedin_visible", "linkedin_disparo_habilitado"],
    idealPara: [
      "empresas médias/grandes, falando com um cargo específico (RH, TI, compras, diretoria)",
      "ticket alto e ciclo longo, em que relacionamento pesa",
      "cliente com perfil de LinkedIn ativo",
    ],
    evitarQuando: [
      "negócios locais, MEI e pequenas empresas",
      "volume alto — o LinkedIn só permite ~15 a 20 convites por dia com segurança",
    ],
    variaveis: VARS_LINKEDIN,
    etapas: ["Dias úteis", "Busca de decisores no LinkedIn", "Funil", "Convite + mensagem"],
    tetoPorExecucao: 500,
    montar: (p, a) => cadeia([agendado(p), linkedin(p, false), funil(a), linkedinDisparo(a)]),
  },
  linkedin_email: {
    id: "linkedin_email",
    nome: "Decisores no LinkedIn → e-mail",
    resumo: "Mesma busca de decisores, com e-mail encontrado e sequência de e-mails — sem o limite de convites.",
    fonte: "linkedin",
    canais: ["email"],
    acoesPorLead: ["linkedin"],
    usaOpenai: false,
    recursos: ["linkedin_visible", "email_disparo_habilitado"],
    idealPara: [
      "cargo específico em empresa média/grande, com mais volume do que os convites permitem",
      "cliente sem LinkedIn ativo mas com domínio de e-mail",
    ],
    evitarQuando: ["público de pequenas empresas", "cliente sem domínio de e-mail"],
    variaveis: VARS_LINKEDIN,
    etapas: ["Dias úteis", "Busca de decisores no LinkedIn (com e-mail)", "Só quem tem e-mail", "Funil", "Sequência de e-mails"],
    tetoPorExecucao: 500,
    montar: (p, a) => cadeia([agendado(p), linkedin(p, true), exigir("email"), funil(a), email(a)]),
  },
  linkedin_ia_abm: {
    id: "linkedin_ia_abm",
    nome: "Contas estratégicas no LinkedIn + pesquisa por IA",
    resumo: "Poucos decisores por dia, cada um pesquisado pela IA antes de um convite personalizado.",
    fonte: "linkedin",
    canais: ["linkedin"],
    acoesPorLead: ["linkedin"],
    usaOpenai: true,
    recursos: ["linkedin_visible", "linkedin_disparo_habilitado", "enriquecimento_ia_habilitado"],
    idealPara: ["ticket muito alto, poucas contas, personalização máxima (estilo ABM)", "cliente com chave OpenAI"],
    evitarQuando: ["volume alto", "ticket baixo — o esforço por lead não se paga"],
    variaveis: [...VARS_LINKEDIN, ...VARS_IA],
    etapas: ["Dias úteis", "Busca de decisores no LinkedIn", "Pesquisa por IA", "Funil", "Convite personalizado + mensagem"],
    tetoPorExecucao: 500,
    montar: (p, a) => cadeia([agendado(p), linkedin(p, false), ia(p), funil(a), linkedinDisparo(a)]),
  },
  instagram_audiencia: {
    id: "instagram_audiencia",
    nome: "Audiência de perfis de referência no Instagram",
    resumo: "Seguidores de perfis parecidos com o seu vão pro funil, com roteiro pra abordar por DM.",
    fonte: "instagram",
    canais: [],
    acoesPorLead: ["instagram"],
    usaOpenai: false,
    recursos: ["instagram_visible"],
    idealPara: [
      "venda pra pessoa física ou criadores (estética, moda, fitness, infoproduto, serviços pessoais)",
      "cliente que informou perfis de referência (concorrente, influenciador do nicho)",
    ],
    evitarQuando: ["B2B tradicional", "sem perfil de referência — a lista fica genérica"],
    variaveis: ["nome", "username"],
    etapas: ["Semanal", "Seguidores de um perfil de referência", "Funil (abordagem por DM)"],
    tetoPorExecucao: 1000,
    montar: (p, a) => cadeia([agendado(p), instagram(p), funil(a)]),
  },
  base_reativacao: {
    id: "base_reativacao",
    nome: "Reativar sua base atual → WhatsApp",
    resumo: "Sua planilha de contatos entra direto na cadência de WhatsApp — sem custo de créditos.",
    fonte: "base_propria",
    canais: ["whatsapp"],
    acoesPorLead: [],
    usaOpenai: false,
    recursos: ["disparo_habilitado"],
    idealPara: [
      "cliente com base parada (ex-clientes, leads antigos, contatos de evento)",
      "o jeito mais barato e rápido de começar — nenhum crédito por lead",
      "novas linhas adicionadas depois na planilha entram sozinhas",
    ],
    evitarQuando: ["cliente sem base", "base sem telefone"],
    variaveis: ["nome", "<qualquer coluna da planilha>"],
    etapas: ["Nova linha na planilha", "Funil", "WhatsApp"],
    tetoPorExecucao: 5000,
    montar: (_p, a) => cadeia([planilha(), funil(a), whatsapp(a)]),
  },
  base_enriquecida: {
    id: "base_enriquecida",
    nome: "Sua base + sócio e contato validado → WhatsApp",
    resumo: "Sua lista com CNPJ ganha sócio e telefone validado antes de ser abordada.",
    fonte: "base_propria",
    canais: ["whatsapp"],
    acoesPorLead: ["bigdatacorp"],
    usaOpenai: false,
    recursos: ["disparo_habilitado", "bigdatacorp_enrichment_habilitado"],
    idealPara: ["base com CNPJ, mas com telefones ruins ou sem saber quem é o decisor"],
    evitarQuando: ["base sem coluna de CNPJ"],
    variaveis: ["nome", "bigdatacorp_socio_nome", "bigdatacorp_razao_social", "<qualquer coluna da planilha>"],
    etapas: ["Nova linha na planilha", "Sócios e contato validado", "Só quem tem telefone", "Funil", "WhatsApp"],
    tetoPorExecucao: 5000,
    montar: (_p, a) => cadeia([planilha(), socios, exigir("telefone"), funil(a), whatsapp(a)]),
  },
  lista_time_comercial: {
    id: "lista_time_comercial",
    nome: "Lista qualificada pro time comercial (sem disparo)",
    resumo: "Empresas com sócio e contato validado chegando no funil, pro seu time abordar do jeito dele.",
    fonte: "cnpj",
    canais: [],
    acoesPorLead: ["cnpj", "bigdatacorp"],
    usaOpenai: false,
    recursos: ["bigdatacorp_enrichment_habilitado"],
    idealPara: [
      "time que prefere ligar ou abordar manualmente",
      "venda muito consultiva, em que mensagem automática não combina",
      "cliente que não quer (ou ainda não pode) conectar canais de disparo",
    ],
    evitarQuando: ["time sem capacidade de trabalhar a lista manualmente"],
    variaveis: VARS_SOCIOS,
    etapas: ["Agendamento", "Busca de empresas por CNAE", "Sócios e contato validado", "Funil"],
    tetoPorExecucao: 2000,
    montar: (p, a) => cadeia([agendado(p), cnpj(p, { comTelefone: false, tipoTelefone: "todos" }), socios, funil(a)]),
  },
};

export const LISTA_CENARIOS: Cenario[] = CENARIO_IDS.map((id) => CENARIOS[id]);

// ── Normalização ───────────────────────────────────────────────────

const INDUSTRIAS_VALIDAS = new Set(LINKEDIN_INDUSTRIES.map((i) => i.value));
const UFS_VALIDAS = new Set(SIGLAS_ESTADOS);

function limpar(lista: string[], max: number): string[] {
  return Array.from(new Set(lista.map((s) => s.trim()).filter(Boolean))).slice(0, max);
}

/**
 * Corrige o que a IA devolveu antes de montar o fluxo: códigos fora do
 * formato, UFs/indústrias inexistentes, agenda vazia, limites fora do que
 * o nó aceita. Nunca inventa segmentação — só descarta o inválido.
 */
export function normalizarParametros(p: ParametrosCenario, cenario: Cenario): ParametrosCenario {
  const cnaes = limpar(p.cnaes.map((c) => c.replace(/\D/g, "")), 30).filter((c) => /^\d{7}$/.test(c));
  const ufs = limpar(p.ufs.map((u) => u.toUpperCase()), 27).filter((u) => UFS_VALIDAS.has(u));
  const diasSemana = Array.from(new Set(p.diasSemana.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
  const horario = /^([01]\d|2[0-3]):[0-5]\d$/.test(p.horario) ? p.horario : "08:30";
  const perfil = p.perfilInstagram?.trim().replace(/^@/, "") || null;

  return {
    ...p,
    cnaes,
    ufs,
    cidades: limpar(p.cidades, 20),
    portes: Array.from(new Set(p.portes)),
    aberturaUltimosDias: p.aberturaUltimosDias && p.aberturaUltimosDias > 0 ? Math.min(Math.round(p.aberturaUltimosDias), 365) : null,
    capitalMinimo: p.capitalMinimo && p.capitalMinimo > 0 ? p.capitalMinimo : null,
    nichoMaps: p.nichoMaps && p.nichoMaps in NICHOS ? p.nichoMaps : null,
    termoMaps: p.termoMaps?.trim() || null,
    minAvaliacoes: p.minAvaliacoes && p.minAvaliacoes > 0 ? Math.round(p.minAvaliacoes) : null,
    cargosLinkedin: limpar(p.cargosLinkedin, 10),
    industriasLinkedin: limpar(p.industriasLinkedin, 15).filter((i) => INDUSTRIAS_VALIDAS.has(i)),
    localizacoesLinkedin: limpar(p.localizacoesLinkedin, 10),
    palavraChaveLinkedin: p.palavraChaveLinkedin?.trim() || null,
    perfilInstagram: perfil,
    camposIa: limpar(p.camposIa, 5),
    leadsPorExecucao: Math.max(1, Math.min(Math.round(p.leadsPorExecucao) || 20, cenario.tetoPorExecucao)),
    diasSemana: diasSemana.length ? diasSemana : [1, 2, 3, 4, 5],
    horario,
  };
}

/**
 * O que ainda impede o cenário de rodar mesmo depois de normalizado —
 * vira aviso no plano (e a IA avaliadora vê). Ex.: CNPJ sem nenhum CNAE.
 */
export function lacunasDoCenario(p: ParametrosCenario, cenario: Cenario): string[] {
  const lacunas: string[] = [];
  if (cenario.fonte === "cnpj" && cenario.id !== "cnpj_recuperacao_judicial" && !p.cnaes.length) {
    lacunas.push("Nenhum CNAE válido definido para a busca de empresas.");
  }
  if (cenario.fonte === "maps" && !p.nichoMaps && !p.termoMaps) lacunas.push("Sem nicho ou termo de busca no Google Maps.");
  if (cenario.fonte === "linkedin" && !p.cargosLinkedin.length && !p.palavraChaveLinkedin) {
    lacunas.push("Sem cargos nem palavra-chave para a busca no LinkedIn.");
  }
  if (cenario.fonte === "instagram" && !p.perfilInstagram) lacunas.push("Sem perfil de referência no Instagram.");
  return lacunas;
}
