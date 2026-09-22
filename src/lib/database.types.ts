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

  google_client_id: string | null;
  google_client_secret: string | null;
  google_sheets_creds: GoogleSheetsCreds | null;

  created_at: string;
  updated_at: string;
}

export type SearchFonte = "cnpj" | "google_maps" | "instagram";

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
}

export type EnrichmentRunStatus = "pendente" | "processando" | "concluido" | "erro";
export type EnrichmentLeadStatus = "pendente" | "concluido" | "nao_encontrado" | "erro";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
