/**
 * Tipos do schema Supabase (supabase/migrations/0001_init.sql), escritos à
 * mão — não há projeto Supabase vivo nesta sessão para rodar
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

export interface MapsKeyPoolEntry {
  key: string;
  limit: number;
  usage: number;
  text_search_usage?: number;
  month: string; // "YYYY-MM"
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
  maps_keys_pool: MapsKeyPoolEntry[];
  maps_pausar_ao_esgotar: boolean;
  created_at: string;
  updated_at: string;
}

export type SearchFonte = "cnpj" | "google_maps";

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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
