import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/credits";
import type {
  BigDataCorpEnrichmentRunRow, BigDataCorpEnrichmentLeadRow, BigDataCorpRunOrigem, Profile,
} from "@/lib/database.types";

// CRUD do enriquecimento por CNPJ via BigDataCorp — mirror estrutural do
// enriquecimento via IA (enrichment_runs/enrichment_leads em db.ts), mas
// com tabelas próprias (bigdatacorp_enrichment_runs/leads,
// supabase/migrations/0012_bigdatacorp_enrichment.sql) porque a entrada
// (CNPJ) e a saída (sócios/telefone/e-mail cadastrados) são diferentes.

const LIMITE_LOTE = 50;

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
): Promise<BigDataCorpEnrichmentRunRow | null> {
  const vistos = new Set<string>();
  const lote: CnpjParaEnriquecer[] = [];
  for (const item of itens) {
    const doc = apenasDigitos(item.cnpj);
    if (doc.length !== 14 || vistos.has(doc)) continue;
    vistos.add(doc);
    lote.push({ cnpj: doc, nomeLead: item.nomeLead });
    if (lote.length >= LIMITE_LOTE) break;
  }
  if (!lote.length) return null;

  const { data: run } = await sb
    .from("bigdatacorp_enrichment_runs")
    .insert({ user_id: userId, status: "pendente", total: lote.length, origem })
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

export async function listarLeadsRunBigDataCorp(sb: SupabaseClient, runId: string): Promise<BigDataCorpEnrichmentLeadRow[]> {
  const { data } = await sb.from("bigdatacorp_enrichment_leads").select("*").eq("run_id", runId).order("created_at", { ascending: true });
  return (data as BigDataCorpEnrichmentLeadRow[]) || [];
}

export async function deletarRunBigDataCorp(sb: SupabaseClient, runId: string): Promise<boolean> {
  const { error } = await sb.from("bigdatacorp_enrichment_runs").delete().eq("id", runId);
  return !error;
}
