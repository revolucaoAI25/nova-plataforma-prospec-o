/**
 * Tipos do schema Supabase (supabase/migrations/*.sql), escritos à mão —
 * não há projeto Supabase vivo nesta sessão para rodar
 * `supabase gen types typescript`. Ao conectar um projeto real, regenerar
 * com o Supabase CLI e substituir este arquivo.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ApiKeyPoolEntry {
  key: string;
  nickname?: string;
  limit: number;
  usage: number;
  text_search_usage?: number;
  month: string; // "YYYY-MM"
}
export type MapsKeyPoolEntry = ApiKeyPoolEntry;

export interface SheetConfig {
  id: string;
  nome: string;
  aba: string;
  modo: "substituir" | "acrescentar";
  padrao?: boolean;
}

export interface GoogleSheetsCreds {
  oauth?: {
    token: string;
    refresh_token?: string;
    token_uri: string;
    client_id: string;
    client_secret: string;
    scopes: string[];
  } | null;
  planilhas?: SheetConfig[];
  auto_export?: boolean;
}

export interface Profile {
  id: string;
  email: string;
  role: "user" | "admin";
  cdd_credits: number;
  monthly_cdd_credits: number;
  maps_credits: number;
  monthly_maps_credits: number;
  maps_credits_enabled: boolean;
  credits_renewed_at: string | null;
  cdd_api_key: string | null;
  google_maps_api_key: string | null;
  cdd_api_key_admin: string | null;
  maps_api_key_admin: string | null;
  maps_keys_pool: MapsKeyPoolEntry[];
  maps_pausar_ao_esgotar: boolean;

  apify_api_key: string | null;
  apify_api_key_admin: string | null;
  apify_keys_pool: ApiKeyPoolEntry[];
  instagram_credits: number;
  monthly_instagram_credits: number;
  instagram_credits_enabled: boolean;
  instagram_visible: boolean;
  disparo_habilitado: boolean;
  conta_teste: boolean;
  teste_expira_em: string | null;

  enriquecimento_ia_habilitado: boolean;
  openai_api_key: string | null;

  linkedin_credits: number;
  monthly_linkedin_credits: number;
  linkedin_credits_enabled: boolean;
  linkedin_visible: boolean;

  email_disparo_habilitado: boolean;
  linkedin_disparo_habilitado: boolean;

  bigdatacorp_enrichment_habilitado: boolean;

  google_client_id: string | null;
  google_client_secret: string | null;
  google_sheets_creds: GoogleSheetsCreds | null;

  creditos: number;
  monthly_creditos: number;

  asaas_customer_id: string | null;
  cpf_cnpj: string | null;

  plano_id: string | null;
  asaas_subscription_id: string | null;
  assinatura_status: AssinaturaStatus;

  created_at: string;
  updated_at: string;
}

/** Chaves de `credit_costs.acao` — cada ação que consome o pool único de créditos. */
export type AcaoCredito =
  | "cnpj"
  | "cnpj_maps_extra"
  | "maps"
  | "instagram"
  | "linkedin"
  | "bigdatacorp";

export interface CreditCostRow {
  acao: AcaoCredito;
  custo: number;
  descricao: string;
  updated_at: string;
}

export interface CreditPackageRow {
  id: string;
  nome: string;
  quantidade_creditos: number;
  preco_centavos: number;
  ordem: number;
  ativo: boolean;
  criado_em: string;
}

export type CreditPurchaseStatus = "pendente" | "pago" | "falhou" | "cancelado";

export interface CreditPurchaseRow {
  id: string;
  user_id: string;
  package_id: string | null;
  quantidade_creditos: number;
  preco_centavos: number;
  asaas_customer_id: string | null;
  asaas_payment_id: string | null;
  status: CreditPurchaseStatus;
  invoice_url: string | null;
  criado_em: string;
  pago_em: string | null;
}

/** Flags booleanos de feature que um plano concede quando a assinatura ativa — mesmo shape dos flags equivalentes em Profile. */
export interface PlanFeatureFlags {
  disparo_habilitado: boolean;
  instagram_visible: boolean;
  linkedin_visible: boolean;
  enriquecimento_ia_habilitado: boolean;
  bigdatacorp_enrichment_habilitado: boolean;
  email_disparo_habilitado: boolean;
  linkedin_disparo_habilitado: boolean;
}

export interface PlanRow extends PlanFeatureFlags {
  id: string;
  nome: string;
  preco_centavos: number;
  creditos_mensais: number;
  email_limite_diario: number | null;
  ordem: number;
  ativo: boolean;
  descricao: string | null;
  criado_em: string;
}

export const PLAN_FEATURE_FLAG_KEYS: (keyof PlanFeatureFlags)[] = [
  "disparo_habilitado",
  "instagram_visible",
  "linkedin_visible",
  "enriquecimento_ia_habilitado",
  "bigdatacorp_enrichment_habilitado",
  "email_disparo_habilitado",
  "linkedin_disparo_habilitado",
];

export type AssinaturaStatus = "sem_assinatura" | "pendente" | "ativa" | "inadimplente" | "cancelada";

export interface SubscriptionPaymentRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  asaas_subscription_id: string;
  asaas_payment_id: string | null;
  preco_centavos: number;
  status: "pago" | "falhou";
  criado_em: string;
}

/** Add-on pago avulso por assinatura recorrente própria — ver 0025_addon_subscriptions.sql. */
export interface AddonRow {
  id: string;
  nome: string;
  preco_centavos: number;
  feature_flag: keyof PlanFeatureFlags;
  ordem: number;
  ativo: boolean;
  descricao: string | null;
  criado_em: string;
}

export type AddonSubscriptionStatus = "pendente" | "ativa" | "inadimplente" | "cancelada";

export interface UserAddonSubscriptionRow {
  id: string;
  user_id: string;
  addon_id: string;
  asaas_subscription_id: string | null;
  status: AddonSubscriptionStatus;
  criado_em: string;
  atualizado_em: string;
}

export interface AddonPaymentRow {
  id: string;
  user_id: string;
  addon_id: string | null;
  asaas_subscription_id: string;
  asaas_payment_id: string | null;
  preco_centavos: number;
  status: "pago" | "falhou";
  criado_em: string;
}

/** Chave de configuração de plataforma administrável — ver src/lib/platform-settings.ts. */
export type PlatformSettingKey =
  | "resend_api_key"
  | "unipile_dsn"
  | "unipile_api_key"
  | "unipile_webhook_secret"
  | "bigdatacorp_token_id"
  | "bigdatacorp_access_token"
  | "asaas_api_key"
  | "asaas_webhook_token"
  | "google_client_id"
  | "google_client_secret"
  | "evolution_api_url"
  | "evolution_api_key"
  | "datafy_api_base_url";

export interface PlatformSettingRow {
  chave: PlatformSettingKey;
  valor: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
}

export type SearchFonte = "cnpj" | "google_maps" | "instagram" | "linkedin";

export interface SearchRow {
  id: string;
  user_id: string;
  fonte: SearchFonte;
  nicho: string | null;
  subnicho: string | null;
  cidade: string | null;
  estado: string | null;
  localidade: string | null;
  total_results: number;
  filtros: Json;
  created_at: string;
}

export interface LeadRow {
  id: string;
  user_id: string;
  search_id: string;
  nome: string | null;
  telefone: string | null;
  telefone2: string | null;
  telefone_internacional: string | null;
  tipo_telefone: string | null;
  email: string | null;
  endereco: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  site: string | null;
  maps_url: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
  status_funcionamento: string | null;
  cnpj: string | null;
  cnae_codigo: string | null;
  matriz_filial: string | null;
  natureza_juridica: string | null;
  data_abertura: string | null;
  capital_social: string | null;
  simples_optante: string | null;
  mei_optante: string | null;
  situacao_especial: string | null;
  socio_principal: string | null;
  porte: string | null;
  nicho: string | null;
  subnicho: string | null;
  cidade_busca: string | null;
  estado_busca: string | null;
  comentario: string | null;
  fonte: string | null;
  instagram_id: string | null;
  username: string | null;
  linkedin_url: string | null;
  cargo: string | null;
  empresa_atual: string | null;
  senioridade: string | null;
  created_at: string;
}

export interface UserStatsRow {
  id: string;
  email: string;
  role: "user" | "admin";
  cdd_credits: number;
  monthly_cdd_credits: number;
  maps_credits: number;
  monthly_maps_credits: number;
  maps_credits_enabled: boolean;
  credits_renewed_at: string | null;
  created_at: string;
  total_searches: number;
  total_leads: number;
  last_search_at: string | null;
  instagram_credits: number;
  monthly_instagram_credits: number;
  instagram_credits_enabled: boolean;
  instagram_visible: boolean;
  disparo_habilitado: boolean;
  conta_teste: boolean;
  teste_expira_em: string | null;
  enriquecimento_ia_habilitado: boolean;
  linkedin_credits: number;
  monthly_linkedin_credits: number;
  linkedin_credits_enabled: boolean;
  linkedin_visible: boolean;
  email_disparo_habilitado: boolean;
  linkedin_disparo_habilitado: boolean;
  bigdatacorp_enrichment_habilitado: boolean;
  creditos: number;
  monthly_creditos: number;
}

export type EnrichmentRunStatus = "pendente" | "processando" | "concluido" | "erro";
export type EnrichmentLeadStatus = "pendente" | "concluido" | "nao_encontrado" | "erro";

// ── Enriquecimento via BigDataCorp (por CNPJ) ───────────────────────────

export type BigDataCorpRunStatus = "pendente" | "processando" | "concluido" | "erro";
export type BigDataCorpLeadStatus = "pendente" | "concluido" | "nao_encontrado" | "erro";
export type BigDataCorpRunOrigem = "manual" | "busca_cnpj" | "fluxo";

export interface BigDataCorpSocioRow {
  nome: string;
  documento: string;
  qualificacao: string;
}

export interface BigDataCorpEnrichmentRunRow {
  id: string;
  user_id: string;
  status: BigDataCorpRunStatus;
  total: number;
  processados: number;
  encontrados: number;
  nao_encontrados: number;
  erros: number;
  origem: BigDataCorpRunOrigem;
  erro: string | null;
  created_at: string;
  concluido_em: string | null;
  processando_desde: string | null;
}

export interface BigDataCorpEnrichmentLeadRow {
  id: string;
  run_id: string;
  user_id: string;
  cnpj_entrada: string;
  nome_lead: string | null;
  status: BigDataCorpLeadStatus;
  razao_social: string | null;
  socios: BigDataCorpSocioRow[] | Json | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  extras: Json | null;
  erro: string | null;
  created_at: string;
}
export type NivelRaciocinio = "rapido" | "equilibrado" | "profundo";

export interface EnrichmentOpcoes {
  nivelRaciocinio: NivelRaciocinio;
  buscarSocios: boolean;
  buscarFundacao: boolean;
  buscarProcessos: boolean;
  camposCustomizados: string[];
}

export interface EnrichmentRunRow {
  id: string;
  user_id: string;
  status: EnrichmentRunStatus;
  total: number;
  processados: number;
  encontrados: number;
  nao_encontrados: number;
  erros: number;
  opcoes: EnrichmentOpcoes | Json;
  erro: string | null;
  created_at: string;
  concluido_em: string | null;
  processando_desde: string | null;
}

export interface EnrichmentLeadRow {
  id: string;
  run_id: string;
  user_id: string;
  nome_lead: string | null;
  email: string | null;
  telefone: string | null;
  status: EnrichmentLeadStatus;
  empresa_nome: string | null;
  cargo: string | null;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  website: string | null;
  linkedin_url: string | null;
  resumo: string | null;
  socios: string | null;
  fundacao: string | null;
  processos_jusbrasil: string | null;
  extras: Record<string, string> | null;
  erro: string | null;
  created_at: string;
}

export type InstanceCanal = "evolution" | "oficial";
export type InstanceStatus = "desconectado" | "conectando" | "conectado";

export interface WhatsappInstanceRow {
  id: string;
  user_id: string;
  nome: string;
  canal: InstanceCanal;
  evolution_instance_name: string | null;
  status: InstanceStatus;
  numero_conectado: string | null;
  ultimo_envio_em: string | null;
  proximo_envio_liberado_em: string | null;
  limite_diario_envios: number | null;
  token_oficial: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  criado_em: string;
}

export type CampaignStatus = "rascunho" | "ativa" | "pausada" | "concluida";
export type CampaignOrigem = "busca_existente" | "upload" | "manual" | "auto_trigger" | "sheet_watch";

export interface DispatchCampaignRow {
  id: string;
  user_id: string;
  nome: string;
  instance_id: string | null;
  status: CampaignStatus;
  tipo_origem: CampaignOrigem;
  origem_search_id: string | null;
  filtro_nicho: string | null;
  filtro_subnicho: string | null;
  filtro_uf: string | null;
  ultimo_trigger_em: string | null;
  intervalo_min_seg: number;
  intervalo_max_seg: number;
  criado_em: string;
}

export interface CadenceStepRow {
  id: string;
  campaign_id: string;
  ordem: number;
  atraso_horas: number;
  corpo_mensagem: string;
  midia_url: string | null;
  template_id: string | null;
  parametros_template: string[];
  criado_em: string;
}

export type TargetStatus = "pendente" | "enviando" | "enviado" | "concluido" | "falhou" | "removido";

export interface DispatchTargetRow {
  id: string;
  campaign_id: string;
  nome: string | null;
  telefone: string;
  lead_snapshot: Json;
  status: TargetStatus;
  current_step_id: string | null;
  proxima_etapa_em: string;
  reservado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface MessageTemplateRow {
  id: string;
  user_id: string;
  instance_id: string | null;
  nome: string;
  categoria: string | null;
  corpo: string;
  variaveis: Json;
  canal: InstanceCanal;
  status_aprovacao: string;
  nome_meta: string | null;
  idioma: string | null;
  componentes: Json;
  meta_template_id: string | null;
  criado_em: string;
}

export interface SheetWatcherRow {
  id: string;
  campaign_id: string;
  sheet_id: string;
  aba_nome: string;
  coluna_telefone: string;
  coluna_nome: string | null;
  ultima_linha_processada: number;
  criado_em: string;
}

export interface OficialConnectionRequestRow {
  id: string;
  user_id: string;
  nome_desejado: string | null;
  telefone_contato: string | null;
  status: "pendente" | "em_andamento" | "concluido";
  observacao: string | null;
  instance_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

// ── Disparo por e-mail (Resend) — espelha as interfaces acima do
// disparo WhatsApp; ver comentário de topo de 0008_email_dispatch.sql
// pras diferenças deliberadas entre os dois canais. ──────────────────

export interface EmailSenderRow {
  id: string;
  user_id: string;
  nome: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  ativo: boolean;
  limite_diario_envios: number | null;
  ultimo_envio_em: string | null;
  proximo_envio_liberado_em: string | null;
  criado_em: string;
}

export type EmailDomainStatus = "not_started" | "pending" | "verified" | "failed";

export interface EmailDomainDnsRecord {
  record: string;
  name: string;
  value: string;
  type: string;
  status: string;
  ttl: string;
  priority?: number;
}

export interface EmailDomainRow {
  id: string;
  user_id: string;
  dominio: string;
  resend_domain_id: string | null;
  status: EmailDomainStatus;
  records: EmailDomainDnsRecord[];
  criado_em: string;
  atualizado_em: string;
}

export interface EmailCampaignRow {
  id: string;
  user_id: string;
  nome: string;
  sender_id: string | null;
  status: CampaignStatus;
  tipo_origem: CampaignOrigem;
  origem_search_id: string | null;
  filtro_nicho: string | null;
  filtro_subnicho: string | null;
  filtro_uf: string | null;
  ultimo_trigger_em: string | null;
  intervalo_min_seg: number;
  intervalo_max_seg: number;
  criado_em: string;
}

export interface EmailTemplateRow {
  id: string;
  user_id: string;
  nome: string;
  assunto: string;
  corpo: string;
  criado_em: string;
}

export interface EmailCadenceStepRow {
  id: string;
  campaign_id: string;
  ordem: number;
  atraso_horas: number;
  assunto: string;
  corpo: string;
  template_id: string | null;
  criado_em: string;
}

export interface EmailTargetRow {
  id: string;
  campaign_id: string;
  nome: string | null;
  email: string;
  lead_snapshot: Json;
  status: TargetStatus;
  current_step_id: string | null;
  proxima_etapa_em: string;
  reservado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface EmailMessageLogRow {
  id: string;
  target_id: string;
  campaign_id: string;
  step_id: string | null;
  enviado_em: string;
  status: "sucesso" | "erro";
  provider_message_id: string | null;
  erro_msg: string | null;
  assunto_enviado: string | null;
  corpo_enviado: string | null;
}

export interface EmailSheetWatcherRow {
  id: string;
  campaign_id: string;
  sheet_id: string;
  aba_nome: string;
  coluna_email: string;
  coluna_nome: string | null;
  ultima_linha_processada: number;
  criado_em: string;
}

// ── Disparo por LinkedIn (Unipile) — espelha as interfaces acima do
// disparo por e-mail; ver comentário de topo de
// 0009_linkedin_dispatch.sql pras diferenças deliberadas (conta real
// logada, tipos de etapa, estado de aceite de convite). ─────────────

export type LinkedinAccountStatus = "conectando" | "conectado" | "desconectado" | "requer_reconexao";

export interface LinkedinAccountRow {
  id: string;
  user_id: string;
  nome: string;
  unipile_account_id: string | null;
  status: LinkedinAccountStatus;
  perfil_nome: string | null;
  limite_diario_convites: number;
  limite_diario_mensagens: number;
  ultimo_convite_em: string | null;
  proximo_convite_liberado_em: string | null;
  ultima_mensagem_em: string | null;
  proximo_mensagem_liberado_em: string | null;
  criado_em: string;
}

export interface LinkedinCampaignRow {
  id: string;
  user_id: string;
  nome: string;
  account_id: string | null;
  status: CampaignStatus;
  tipo_origem: CampaignOrigem;
  origem_search_id: string | null;
  filtro_nicho: string | null;
  filtro_subnicho: string | null;
  filtro_uf: string | null;
  ultimo_trigger_em: string | null;
  intervalo_min_seg: number;
  intervalo_max_seg: number;
  criado_em: string;
}

export interface LinkedinTemplateRow {
  id: string;
  user_id: string;
  nome: string;
  corpo: string;
  criado_em: string;
}

export type LinkedinStepTipo = "convite" | "mensagem";

export interface LinkedinCadenceStepRow {
  id: string;
  campaign_id: string;
  ordem: number;
  atraso_horas: number;
  tipo: LinkedinStepTipo;
  nota: string | null;
  corpo: string | null;
  template_id: string | null;
  criado_em: string;
}

export type LinkedinTargetStatus = "pendente" | "enviando" | "aguardando_aceite" | "enviado" | "concluido" | "falhou" | "removido";

export interface LinkedinTargetRow {
  id: string;
  campaign_id: string;
  nome: string | null;
  linkedin_url: string;
  provider_id: string | null;
  chat_id: string | null;
  lead_snapshot: Json;
  status: LinkedinTargetStatus;
  current_step_id: string | null;
  proxima_etapa_em: string;
  reservado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface LinkedinMessageLogRow {
  id: string;
  target_id: string;
  campaign_id: string;
  step_id: string | null;
  enviado_em: string;
  status: "sucesso" | "erro";
  tipo_acao: LinkedinStepTipo;
  provider_ref: string | null;
  erro_msg: string | null;
  corpo_enviado: string | null;
}

export interface LinkedinSheetWatcherRow {
  id: string;
  campaign_id: string;
  sheet_id: string;
  aba_nome: string;
  coluna_url: string;
  coluna_nome: string | null;
  ultima_linha_processada: number;
  criado_em: string;
}

export type AutomationTipo = "maps" | "cnpj";

export interface AutomationRow {
  id: string;
  user_id: string;
  nome: string;
  tipo: AutomationTipo;
  filtros: Json;
  sheet_id: string | null;
  sheet_aba: string | null;
  dias_semana: number[];
  horario: string;
  ativa: boolean;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  dispatch_campaign_id: string | null;
  created_at: string;
}

export interface AutomationRunRow {
  id: string;
  automation_id: string;
  user_id: string;
  iniciada_em: string;
  concluida_em: string | null;
  leads_encontrados: number;
  status: "running" | "success" | "error" | "sem_creditos" | "sem_sheets";
  erro: string | null;
}

// ── Fluxos (construtor de automações estilo N8N/Make) ────────────
export type FlowNodeTipo =
  | "gatilho_agendado"
  | "gatilho_filtro_leads"
  | "gatilho_planilha"
  | "gatilho_manual"
  | "extracao_cnpj"
  | "extracao_maps"
  | "extracao_instagram"
  | "extracao_linkedin"
  | "fonte_historico"
  | "enriquecimento_ia"
  | "enriquecimento_maps"
  | "enriquecimento_bigdatacorp"
  | "filtro_leads"
  | "espera"
  | "disparo_whatsapp"
  | "disparo_email"
  | "disparo_linkedin"
  | "destino_sheets"
  | "destino_funil";

export interface FlowNode {
  id: string;
  tipo: FlowNodeTipo;
  config: Json;
  posicao: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
}

export interface AutomationFlowRow {
  id: string;
  user_id: string;
  nome: string;
  ativo: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  gatilho_estado: Json;
  created_at: string;
  updated_at: string;
}

export type FlowRunStatus = "executando" | "aguardando_subprocesso" | "aguardando_retry" | "concluido" | "erro";

export interface FlowRunRow {
  id: string;
  flow_id: string;
  user_id: string;
  status: FlowRunStatus;
  no_atual_id: string | null;
  contexto: Json;
  iniciado_em: string;
  concluido_em: string | null;
  erro: string | null;
  tentativas: number;
  max_tentativas: number;
  proxima_tentativa_em: string | null;
}

export type FlowRunStepStatus = "pendente" | "executando" | "concluido" | "erro" | "pulado";

export interface FlowRunStepRow {
  id: string;
  run_id: string;
  node_id: string;
  tipo: FlowNodeTipo;
  status: FlowRunStepStatus;
  leads_entrada: number | null;
  leads_saida: number | null;
  detalhe: Json;
  erro: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
}

// ── Funil (Kanban) ──────────────────────────────────────────────────

export interface FunilRow {
  id: string;
  user_id: string;
  nome: string;
  criado_em: string;
}

export interface FunilColunaRow {
  id: string;
  funil_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  fluxo_id: string | null;
  criado_em: string;
}

export interface FunilCardRow {
  id: string;
  funil_id: string;
  coluna_id: string;
  user_id: string;
  lead_id: string | null;
  lead_snapshot: Record<string, unknown>;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
