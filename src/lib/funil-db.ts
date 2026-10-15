import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunilRow, FunilColunaRow, FunilCardRow, Profile, AutomationFlowRow, PapelColunaFunil } from "@/lib/database.types";
import { criarRunDoFluxo } from "@/lib/flow/flow-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { chaveEmail, chaveTelefone, contatosDoLead, telefonesDoLead } from "@/lib/contatos";
import { PAPEIS_PRE_RESPOSTA, pararCadencias } from "@/lib/funil-automacao";
import type { OutroContato } from "@/lib/funil-resumo";

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
export interface ResultadoAdicionarAoFunil {
  adicionados: number;
  /** Já estavam no funil e avançaram para a coluna pedida. */
  movidos: number;
  /** Já estavam no funil (na mesma coluna ou mais adiante) e ficaram onde estavam. */
  jaNoFunil: number;
  /** Mesma empresa de um card que já existe, mas com outro contato (outro sócio): o contato entrou no card. */
  contatosNovos: number;
}

/** O que o lead traz de contato que o card ainda não tem — vira um item de `outros_contatos`. */
function outrosContatosDoLead(lead: Record<string, unknown>, jaTem: Set<string>): OutroContato[] {
  const nome = String(lead.socio_nome || lead.socio_principal || "").trim() || undefined;
  const cargo = String(lead.socio_cargo || "").trim() || undefined;
  const saida: OutroContato[] = [];
  for (const t of telefonesDoLead(lead)) {
    const chave = chaveTelefone(t.numero);
    if (!chave || jaTem.has(chave)) continue;
    const doSocio = t.rotulo === "Celular do sócio";
    saida.push({ telefone: t.numero, rotulo: t.rotulo, whatsapp: t.whatsapp, ...(doSocio ? { nome, cargo } : {}) });
  }
  const email = chaveEmail(lead.email);
  if (email && !jaTem.has(email)) saida.push({ email: String(lead.email).trim(), rotulo: "E-mail", nome });
  return saida;
}

/**
 * Coloca leads numa coluna do funil sem duplicar card: lead que já está no
 * funil (mesmo telefone, e-mail ou LinkedIn) não ganha card novo. Com
 * `avancarExistentes`, o card existente anda para a coluna pedida se ela
 * vier depois da atual (nunca volta: um lead em "Respondeu" não regride
 * para "Em cadência" porque passou por outro ramo do fluxo).
 *
 * O card é o negócio (a empresa): o segundo sócio da mesma empresa — que
 * chega como outro lead, com o mesmo e-mail ou telefone da empresa — não
 * se perde: o celular dele entra no card (contatos e `outros_contatos`),
 * aparece no detalhe do negócio e uma resposta dele também move o card.
 */
export async function adicionarLeadsAoFunil(
  sb: SupabaseClient,
  funilId: string,
  colunaId: string,
  userId: string,
  leads: Array<Record<string, unknown>>,
  opcoes: { avancarExistentes?: boolean } = {},
): Promise<ResultadoAdicionarAoFunil> {
  const resultado: ResultadoAdicionarAoFunil = { adicionados: 0, movidos: 0, jaNoFunil: 0, contatosNovos: 0 };
  if (!leads.length) return resultado;
  const existentes = await listarCards(sb, funilId);
  const { data: colunasData } = await sb.from("funil_colunas").select("id, ordem").eq("funil_id", funilId);
  const ordemColuna = new Map(((colunasData ?? []) as { id: string; ordem: number }[]).map((c) => [c.id, c.ordem]));
  const destino = ordemColuna.get(colunaId) ?? 0;

  // Card de destino de cada contato: um card que já existe ou uma linha
  // nova deste lote (dois sócios da mesma empresa no mesmo lote).
  type Alvo = { tipo: "card"; card: FunilCardRow } | { tipo: "novo"; linha: LinhaNova };
  type LinhaNova = { contatos: string[]; lead_snapshot: Record<string, unknown> } & Record<string, unknown>;
  const alvoPorContato = new Map<string, Alvo>();
  for (const card of existentes) for (const c of card.contatos ?? []) alvoPorContato.set(c, { tipo: "card", card });

  let ordem = existentes.length ? Math.max(...existentes.map((c) => c.ordem)) + 1 : 0;
  const linhas: LinhaNova[] = [];
  const mover = new Set<string>();
  const cardsAlterados = new Map<string, FunilCardRow>();

  for (const lead of leads) {
    const contatos = contatosDoLead(lead);
    const alvo = contatos.map((c) => alvoPorContato.get(c)).find(Boolean);
    if (!alvo) {
      const linha: LinhaNova = {
        funil_id: funilId,
        coluna_id: colunaId,
        user_id: userId,
        lead_id: (lead.id as string) || null,
        lead_snapshot: lead,
        contatos,
        ordem: ordem++,
      };
      linhas.push(linha);
      for (const c of contatos) alvoPorContato.set(c, { tipo: "novo", linha });
      continue;
    }

    const jaTem = new Set(alvo.tipo === "card" ? alvo.card.contatos ?? [] : alvo.linha.contatos);
    const novos = contatos.filter((c) => !jaTem.has(c));
    if (novos.length) {
      const snapshot = alvo.tipo === "card" ? (alvo.card.lead_snapshot as Record<string, unknown>) : alvo.linha.lead_snapshot;
      const outros = [...((snapshot.outros_contatos as OutroContato[] | undefined) ?? []), ...outrosContatosDoLead(lead, jaTem)];
      const novoSnapshot = { ...snapshot, outros_contatos: outros };
      const todos = [...jaTem, ...novos];
      if (alvo.tipo === "card") {
        alvo.card.contatos = todos;
        alvo.card.lead_snapshot = novoSnapshot;
        cardsAlterados.set(alvo.card.id, alvo.card);
      } else {
        alvo.linha.contatos = todos;
        alvo.linha.lead_snapshot = novoSnapshot;
      }
      for (const c of novos) alvoPorContato.set(c, alvo);
      resultado.contatosNovos++;
    }
    if (alvo.tipo === "novo") continue;
    const atual = ordemColuna.get(alvo.card.coluna_id) ?? 0;
    if (opcoes.avancarExistentes && atual < destino) mover.add(alvo.card.id);
    else if (!novos.length) resultado.jaNoFunil++;
  }

  if (linhas.length) {
    const { error } = await sb.from("funil_cards").insert(linhas);
    if (!error) resultado.adicionados = linhas.length;
  }
  for (const card of cardsAlterados.values()) {
    await sb
      .from("funil_cards")
      .update({ contatos: card.contatos, lead_snapshot: card.lead_snapshot, atualizado_em: new Date().toISOString() })
      .eq("id", card.id);
  }
  if (mover.size) {
    const { error } = await sb
      .from("funil_cards")
      .update({ coluna_id: colunaId, atualizado_em: new Date().toISOString() })
      .in("id", [...mover]);
    if (!error) resultado.movidos = mover.size;
  }
  return resultado;
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

export async function salvarAnotacoes(sb: SupabaseClient, cardId: string, anotacoes: string): Promise<boolean> {
  const { error } = await sb
    .from("funil_cards")
    .update({ anotacoes: anotacoes.trim() || null, atualizado_em: new Date().toISOString() })
    .eq("id", cardId);
  return !error;
}

export async function excluirCard(sb: SupabaseClient, cardId: string): Promise<boolean> {
  const { error } = await sb.from("funil_cards").delete().eq("id", cardId);
  return !error;
}
