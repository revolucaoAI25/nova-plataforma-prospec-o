import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/credits";
import type {
  BigDataCorpEnrichmentRunRow, BigDataCorpEnrichmentLeadRow, BigDataCorpRunOrigem, OpcoesCelularSocio, Profile,
} from "@/lib/database.types";
import { directDataConfigurado } from "@/lib/integrations/direct-data";
import { normalizarOpcoesCelularSocio } from "@/lib/celular-socio";

// CRUD do enriquecimento "Sócios e Contato" (celular do sócio, Direct Data;
// as tabelas guardam o prefixo do fornecedor anterior) — mirror estrutural do
// enriquecimento via IA (enrichment_runs/enrichment_leads em db.ts), mas
// com tabelas próprias (bigdatacorp_enrichment_runs/leads,
// supabase/migrations/0012_bigdatacorp_enrichment.sql) porque a entrada
// (CNPJ) e a saída (sócios/telefone/e-mail cadastrados) são diferentes.

const LIMITE_LOTE = 50;
/** A busca por CNPJ manda todos os resultados (o worker vai no ritmo dele). */
export const LIMITE_LOTE_BUSCA = 2000;

/** Token da Direct Data cadastrado (é ela que acha o celular do sócio). */
export function sociosEContatoConfigurado(): Promise<boolean> {
  return directDataConfigurado();
}

/** Perfil só se `bigdatacorp_enrichment_habilitado` (ou admin) — gate usado por toda rota de API desse enriquecimento. */
export async function perfilComBigDataCorpEnrichmentHabilitado(sb: SupabaseClient, userId: string): Promise<Profile | null> {
  const profile = await getProfile(sb, userId);
  if (!profile) return null;
  if (!profile.bigdatacorp_enrichment_habilitado && profile.role !== "admin") return null;
  return profile;
}

function apenasDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export interface CnpjParaEnriquecer {
  cnpj: string;
  nomeLead?: string;
}

/**
 * Cria uma execução (lote) — dedupe simples por CNPJ dentro do próprio
 * lote, corta em `LIMITE_LOTE`, descarta CNPJs com menos de 14 dígitos.
 * O worker (`tickBigDataCorpEnrichment`, a cada ~10s) processa em
 * background, mesmo padrão do enriquecimento via IA.
 */
export async function criarRunBigDataCorp(
  sb: SupabaseClient, userId: string, itens: CnpjParaEnriquecer[], origem: BigDataCorpRunOrigem,
  extras: { opcoes?: Partial<OpcoesCelularSocio>; searchId?: string; limite?: number } = {},
): Promise<BigDataCorpEnrichmentRunRow | null> {
  const limite = extras.limite ?? LIMITE_LOTE;
  const vistos = new Set<string>();
  const lote: CnpjParaEnriquecer[] = [];
  for (const item of itens) {
    const doc = apenasDigitos(item.cnpj);
    if (doc.length !== 14 || vistos.has(doc)) continue;
    vistos.add(doc);
    lote.push({ cnpj: doc, nomeLead: item.nomeLead });
    if (lote.length >= limite) break;
  }
  if (!lote.length) return null;

  const { data: run } = await sb
    .from("bigdatacorp_enrichment_runs")
    .insert({
      user_id: userId, status: "pendente", total: lote.length, origem,
      opcoes: normalizarOpcoesCelularSocio(extras.opcoes), search_id: extras.searchId ?? null,
    })
    .select("*")
    .single();
  if (!run) return null;

  const linhas = lote.map((item) => ({
    run_id: run.id, user_id: userId, cnpj_entrada: item.cnpj, nome_lead: item.nomeLead?.trim() || null, status: "pendente" as const,
  }));
  const { error: leadsError } = await sb.from("bigdatacorp_enrichment_leads").insert(linhas);
  if (leadsError) {
    await sb.from("bigdatacorp_enrichment_runs").delete().eq("id", run.id);
    return null;
  }

  return run as BigDataCorpEnrichmentRunRow;
}

export async function listarRunsBigDataCorp(sb: SupabaseClient, userId: string): Promise<BigDataCorpEnrichmentRunRow[]> {
  const { data } = await sb.from("bigdatacorp_enrichment_runs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  return (data as BigDataCorpEnrichmentRunRow[]) || [];
}

export async function obterRunBigDataCorp(sb: SupabaseClient, runId: string): Promise<BigDataCorpEnrichmentRunRow | null> {
  const { data } = await sb.from("bigdatacorp_enrichment_runs").select("*").eq("id", runId).single();
  return (data as BigDataCorpEnrichmentRunRow) || null;
}

/** Em páginas de 1000: execuções da busca por CNPJ vão até 2000 empresas (o teto por consulta do banco é 1000). */
export async function listarLeadsRunBigDataCorp(sb: SupabaseClient, runId: string): Promise<BigDataCorpEnrichmentLeadRow[]> {
  const todos: BigDataCorpEnrichmentLeadRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await sb
      .from("bigdatacorp_enrichment_leads")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    const pagina = (data as BigDataCorpEnrichmentLeadRow[]) || [];
    todos.push(...pagina);
    if (pagina.length < 1000) return todos;
  }
}

export async function deletarRunBigDataCorp(sb: SupabaseClient, runId: string): Promise<boolean> {
  const { error } = await sb.from("bigdatacorp_enrichment_runs").delete().eq("id", runId);
  return !error;
}
