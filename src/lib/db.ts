import type { SupabaseClient } from "@supabase/supabase-js";
import { apenasDigitos } from "@/lib/phone";
import type { Lead } from "@/lib/types";
import type { SearchFonte, SearchRow, LeadRow, Json } from "@/lib/database.types";

// Persistência de pesquisas/leads — portado de modules/database.py.
// Diferente do produto atual, `filtros` guarda o filtro COMPLETO da busca
// (não só um resumo), permitindo auditoria/replay — melhoria sugerida na
// seção 5.3 do plano de reconstrução.

export async function salvarPesquisa(
  supabase: SupabaseClient,
  userId: string,
  params: {
    fonte: SearchFonte;
    nicho: string;
    subnicho: string;
    cidade: string;
    estado: string;
    localidade: string;
    totalResults: number;
    filtros: Json;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("searches")
    .insert({
      user_id: userId,
      fonte: params.fonte,
      nicho: params.nicho,
      subnicho: params.subnicho,
      cidade: params.cidade,
      estado: params.estado,
      localidade: params.localidade,
      total_results: params.totalResults,
      filtros: params.filtros,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

function leadToRow(userId: string, searchId: string, r: Lead) {
  return {
    user_id: userId,
    search_id: searchId,
    nome: r.nome || "",
    telefone: r.telefone || "",
    telefone2: r.telefone2 || "",
    telefone_internacional: r.telefone_internacional || "",
    tipo_telefone: r.tipo_telefone || "",
    email: r.email || "",
    endereco: r.endereco || "",
    municipio: r.municipio || "",
    uf: r.uf || "",
    cep: r.cep || "",
    site: r.site || "",
    maps_url: r.maps_url || "",
    avaliacao: r.avaliacao === "" ? null : Number(r.avaliacao),
    total_avaliacoes: r.total_avaliacoes === "" ? null : Number(r.total_avaliacoes),
    status_funcionamento: r.status_funcionamento || "",
    cnpj: r.cnpj || "",
    cnae_codigo: r.cnae_codigo || "",
    matriz_filial: r.matriz_filial || "",
    natureza_juridica: r.natureza_juridica || "",
    data_abertura: r.data_abertura || "",
    capital_social: r.capital_social || "",
    simples_optante: r.simples_optante || "",
    mei_optante: r.mei_optante || "",
    situacao_especial: r.situacao_especial || "",
    socio_principal: r.socio_principal || "",
    porte: r.porte || "",
    nicho: r.nicho_busca || "",
    subnicho: r.subnicho_busca || "",
    cidade_busca: r.cidade_busca || "",
    estado_busca: r.estado_busca || "",
    comentario: r.comentario || "",
    fonte: r.fonte || "",
  };
}

export async function salvarLeads(
  supabase: SupabaseClient,
  userId: string,
  searchId: string,
  resultados: Lead[],
): Promise<boolean> {
  if (!searchId || !resultados.length) return false;
  const linhas = resultados.map((r) => leadToRow(userId, searchId, r));
  try {
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await supabase.from("leads").insert(linhas.slice(i, i + 500));
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function listarPesquisas(supabase: SupabaseClient, limite = 300): Promise<SearchRow[]> {
  const { data } = await supabase
    .from("searches")
    .select("id, fonte, nicho, subnicho, cidade, estado, localidade, total_results, filtros, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(limite);
  return (data as SearchRow[]) ?? [];
}

export async function buscarLeadsDaPesquisa(
  supabase: SupabaseClient,
  searchId: string,
): Promise<LeadRow[]> {
  const leads: LeadRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  // Pagina em blocos de 1000 — buscas grandes (limite de resultados vai até
  // 2000) ultrapassam o teto padrão de linhas por requisição do PostgREST.
  for (;;) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("search_id", searchId)
      .order("nome")
      .range(offset, offset + pageSize - 1);
    const linhas = (data as LeadRow[]) ?? [];
    leads.push(...linhas);
    if (linhas.length < pageSize) break;
    offset += pageSize;
  }
  return leads;
}

/** Retorna (telefones, cnpjs) já salvos pelo usuário — usado na deduplicação "apenas leads novos". */
export async function buscarIdentificadoresExistentes(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ telefones: Set<string>; cnpjs: Set<string> }> {
  const telefones = new Set<string>();
  const cnpjs = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("leads")
      .select("telefone, telefone2, cnpj")
      .eq("user_id", userId)
      .range(offset, offset + pageSize - 1);
    const linhas = (data as Array<{ telefone: string; telefone2: string; cnpj: string }>) ?? [];
    for (const r of linhas) {
      const d1 = apenasDigitos(r.telefone);
      const d2 = apenasDigitos(r.telefone2);
      if (d1) telefones.add(d1);
      if (d2) telefones.add(d2);
      if (r.cnpj) cnpjs.add(r.cnpj);
    }
    if (linhas.length < pageSize) break;
    offset += pageSize;
  }
  return { telefones, cnpjs };
}

export async function deletarPesquisa(
  supabase: SupabaseClient,
  searchId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await supabase.from("searches").delete().eq("id", searchId);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
