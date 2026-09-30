import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunilRow, FunilColunaRow, FunilCardRow, Profile, AutomationFlowRow, PapelColunaFunil } from "@/lib/database.types";
import { criarRunDoFluxo } from "@/lib/flow/flow-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { contatosDoLead } from "@/lib/contatos";
import { PAPEIS_PRE_RESPOSTA, pararCadencias } from "@/lib/funil-automacao";

// CRUD do Funil (Kanban) — visão de pipeline sobre leads já extraídos.
// Mesma disciplina de IDOR dos outros módulos *-db.ts do projeto: toda
// rota de API que recebe um id de coluna/card confirma que ele pertence
// ao funil (e o funil ao usuário) antes de aceitar a operação.

const COLUNAS_PADRAO = ["Novo", "Contatado", "Qualificado", "Fechado"];

export async function listarFunis(sb: SupabaseClient, userId: string): Promise<FunilRow[]> {
  const { data } = await sb.from("funis").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
  return (data as FunilRow[]) || [];
}

export async function obterFunil(sb: SupabaseClient, funilId: string): Promise<FunilRow | null> {
  const { data } = await sb.from("funis").select("*").eq("id", funilId).single();
  return (data as FunilRow) || null;
}

export async function funilPertenceAoUsuario(sb: SupabaseClient, funilId: string, profile: Profile): Promise<boolean> {
  const funil = await obterFunil(sb, funilId);
  if (!funil) return false;
  return profile.role === "admin" || funil.user_id === profile.id;
}

/** Cria o funil já com as colunas padrão (o usuário renomeia/reorganiza depois). */
export interface ColunaNova {
  nome: string;
  papel?: PapelColunaFunil | null;
}

/** Sem `colunas`, cria as padrão (funil manual, sem automação). Com `colunas`, usa as etapas e papéis informados. */
export async function criarFunil(sb: SupabaseClient, userId: string, nome: string, colunas?: ColunaNova[]): Promise<string | undefined> {
  const { data } = await sb.from("funis").insert({ user_id: userId, nome }).select("id").single();
  const funilId = data?.id as string | undefined;
  if (!funilId) return undefined;

  const lista: ColunaNova[] = colunas?.length ? colunas : COLUNAS_PADRAO.map((n) => ({ nome: n }));
  await sb.from("funil_colunas").insert(
    lista.map((c, i) => ({ funil_id: funilId, nome: c.nome, ordem: i, papel: c.papel ?? null })),
  );
  return funilId;
}

export async function renomearFunil(sb: SupabaseClient, funilId: string, nome: string): Promise<boolean> {
  const { error } = await sb.from("funis").update({ nome }).eq("id", funilId);
  return !error;
}

export async function excluirFunil(sb: SupabaseClient, funilId: string): Promise<boolean> {
  const { error } = await sb.from("funis").delete().eq("id", funilId);
  return !error;
}

// ── Colunas ──────────────────────────────────────────────────────────

export async function listarColunas(sb: SupabaseClient, funilId: string): Promise<FunilColunaRow[]> {
  const { data } = await sb.from("funil_colunas").select("*").eq("funil_id", funilId).order("ordem");
  return (data as FunilColunaRow[]) || [];
}

export async function obterColuna(sb: SupabaseClient, colunaId: string): Promise<FunilColunaRow | null> {
  const { data } = await sb.from("funil_colunas").select("*").eq("id", colunaId).single();
  return (data as FunilColunaRow) || null;
}

export async function colunaPertenceAoFunil(sb: SupabaseClient, colunaId: string, funilId: string): Promise<boolean> {
  const coluna = await obterColuna(sb, colunaId);
  return Boolean(coluna && coluna.funil_id === funilId);
}

export async function criarColuna(sb: SupabaseClient, funilId: string, nome: string): Promise<string | undefined> {
  const colunas = await listarColunas(sb, funilId);
  const ordem = colunas.length ? Math.max(...colunas.map((c) => c.ordem)) + 1 : 0;
  const { data } = await sb.from("funil_colunas").insert({ funil_id: funilId, nome, ordem }).select("id").single();
  return data?.id as string | undefined;
}

export async function atualizarColuna(
  sb: SupabaseClient,
  colunaId: string,
  campos: Partial<Pick<FunilColunaRow, "nome" | "ordem" | "cor" | "fluxo_id">>,
): Promise<boolean> {
  const { error } = await sb.from("funil_colunas").update(campos).eq("id", colunaId);
  return !error;
}

/** Apaga a coluna — os cards dentro dela são apagados junto (cascade na migration), não movidos pra outra coluna automaticamente. */
export async function excluirColuna(sb: SupabaseClient, colunaId: string): Promise<boolean> {
  const { error } = await sb.from("funil_colunas").delete().eq("id", colunaId);
  return !error;
}

// ── Cards ────────────────────────────────────────────────────────────

export async function listarCards(sb: SupabaseClient, funilId: string): Promise<FunilCardRow[]> {
  const { data } = await sb.from("funil_cards").select("*").eq("funil_id", funilId).order("ordem");
  return (data as FunilCardRow[]) || [];
}

export async function obterCard(sb: SupabaseClient, cardId: string): Promise<FunilCardRow | null> {
  const { data } = await sb.from("funil_cards").select("*").eq("id", cardId).single();
  return (data as FunilCardRow) || null;
}

/**
 * Adiciona um lote de leads como cards numa coluna — usado tanto pela
 * rota "Adicionar ao Funil" (a partir de uma pesquisa do histórico)
 * quanto pelo executor de fluxo `destino_funil`. `lead_snapshot` guarda o
 * registro inteiro; a UI escolhe os campos relevantes pra exibir no card.
 */
export async function adicionarLeadsAoFunil(
  sb: SupabaseClient,
  funilId: string,
  colunaId: string,
  userId: string,
  leads: Array<Record<string, unknown>>,
): Promise<number> {
  if (!leads.length) return 0;
  const existentes = await listarCards(sb, funilId);
  let ordem = existentes.length ? Math.max(...existentes.map((c) => c.ordem)) + 1 : 0;

  const linhas = leads.map((lead) => ({
    funil_id: funilId,
    coluna_id: colunaId,
    user_id: userId,
    lead_id: (lead.id as string) || null,
    lead_snapshot: lead,
    contatos: contatosDoLead(lead),
    ordem: ordem++,
  }));

  const { error } = await sb.from("funil_cards").insert(linhas);
  return error ? 0 : linhas.length;
}

/**
 * Move um card pra outra coluna (arraste na UI). Quando a coluna de
 * destino tem `fluxo_id` configurado E o card está de fato TROCANDO de
 * coluna (não só reordenando dentro da mesma), dispara aquele fluxo pra
 * esse 1 lead via `criarRunDoFluxo` — mesmo motor usado pelos outros
 * gatilhos, sem checagem de `temRunAtiva` bloqueando: cada card move é um
 * lead individual, então runs concorrentes do mesmo fluxo (por cards
 * diferentes) são esperadas, não um bug.
 */
export async function moverCard(
  sb: SupabaseClient,
  cardId: string,
  novaColunaId: string,
  novaOrdem: number,
): Promise<{ ok: boolean; fluxoDisparado?: string }> {
  const card = await obterCard(sb, cardId);
  if (!card) return { ok: false };
  const colunaMudou = card.coluna_id !== novaColunaId;

  const { error } = await sb
    .from("funil_cards")
    .update({ coluna_id: novaColunaId, ordem: novaOrdem, atualizado_em: new Date().toISOString() })
    .eq("id", cardId);
  if (error) return { ok: false };

  if (!colunaMudou) return { ok: true };

  const [colunaOrigem, colunaDestino] = await Promise.all([obterColuna(sb, card.coluna_id), obterColuna(sb, novaColunaId)]);

  // Arrastar pra frente num funil automático = "já falei com esse lead"
  // (resposta por e-mail, ligação, conversa fora da plataforma): tira ele
  // da cadência em todos os canais, igual a uma resposta detectada.
  const saiuDaCadencia =
    colunaOrigem?.papel && PAPEIS_PRE_RESPOSTA.includes(colunaOrigem.papel) &&
    colunaDestino?.papel && !PAPEIS_PRE_RESPOSTA.includes(colunaDestino.papel);
  if (saiuDaCadencia && card.contatos?.length) {
    await pararCadencias(createAdminClient(), card.user_id, card.contatos).catch(() => 0);
  }

  if (!colunaDestino?.fluxo_id) return { ok: true };

  const { data: flowRow } = await sb.from("automation_flows").select("*").eq("id", colunaDestino.fluxo_id).eq("ativo", true).maybeSingle();
  if (!flowRow) return { ok: true };

  const runId = await criarRunDoFluxo(sb, flowRow as AutomationFlowRow, { lote: [card.lead_snapshot] });
  return { ok: true, fluxoDisparado: runId || undefined };
}

export async function excluirCard(sb: SupabaseClient, cardId: string): Promise<boolean> {
  const { error } = await sb.from("funil_cards").delete().eq("id", cardId);
  return !error;
}
