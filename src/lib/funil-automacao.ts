import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunilCardRow, FunilColunaRow, PapelColunaFunil } from "@/lib/database.types";
import { partesTelefone } from "@/lib/contatos";

// Funil automático (funis criados pelas sugestões do onboarding, colunas
// com `papel`): o primeiro envio move o card de "Novos leads" pra "Em
// cadência"; uma resposta (webhook do WhatsApp/LinkedIn, ou o próprio
// usuário arrastando o card) tira o lead da cadência em TODOS os canais e
// move pra "Respondeu". Funis manuais (papel nulo) não são tocados.
// Sempre com o cliente admin: roda a partir de webhook e do worker.

const EM_CADENCIA = ["pendente", "enviando", "enviado", "aguardando_aceite"];

/** Papéis anteriores à resposta — só esses são "puxados" pra frente pela automação. */
export const PAPEIS_PRE_RESPOSTA: PapelColunaFunil[] = ["entrada", "cadencia"];

async function moverCards(sb: SupabaseClient, userId: string, contatos: string[], de: PapelColunaFunil[], para: PapelColunaFunil): Promise<number> {
  if (!contatos.length) return 0;
  const { data: cardsData } = await sb
    .from("funil_cards")
    .select("id, funil_id, coluna_id")
    .eq("user_id", userId)
    .overlaps("contatos", contatos);
  const cards = (cardsData ?? []) as Pick<FunilCardRow, "id" | "funil_id" | "coluna_id">[];
  if (!cards.length) return 0;

  const funis = Array.from(new Set(cards.map((c) => c.funil_id)));
  const { data: colunasData } = await sb.from("funil_colunas").select("id, funil_id, papel").in("funil_id", funis);
  const colunas = (colunasData ?? []) as Pick<FunilColunaRow, "id" | "funil_id" | "papel">[];
  const papelDa = new Map(colunas.map((c) => [c.id, c.papel]));

  let movidos = 0;
  for (const card of cards) {
    const papelAtual = papelDa.get(card.coluna_id);
    if (!papelAtual || !de.includes(papelAtual)) continue;
    const destino = colunas.find((c) => c.funil_id === card.funil_id && c.papel === para);
    if (!destino) continue;
    const { error } = await sb
      .from("funil_cards")
      .update({ coluna_id: destino.id, atualizado_em: new Date().toISOString() })
      .eq("id", card.id)
      .eq("coluna_id", card.coluna_id);
    if (!error) movidos++;
  }
  return movidos;
}

/**
 * Tira o contato da fila de follow-up em todos os canais do usuário. O
 * `status in (...)` evita reabrir alvo já concluído/removido e, pro alvo em
 * pleno envio, o worker só grava o resultado se ainda estiver "enviando".
 */
export async function pararCadencias(sb: SupabaseClient, userId: string, contatos: string[]): Promise<number> {
  const agora = new Date().toISOString();
  const campos = { status: "respondeu", respondido_em: agora, atualizado_em: agora };
  let parados = 0;

  for (const chave of contatos) {
    const tel = partesTelefone(chave);
    if (tel) {
      const { data } = await sb
        .from("dispatch_targets")
        .select("id, telefone, dispatch_campaigns!inner(user_id)")
        .eq("dispatch_campaigns.user_id", userId)
        .in("status", EM_CADENCIA)
        .like("telefone", `%${tel.final8}`);
      const ids = ((data ?? []) as { id: string; telefone: string }[])
        .filter((t) => {
          const d = t.telefone.replace(/\D/g, "").replace(/^55(?=\d{10,})/, "");
          return d.slice(0, 2) === tel.ddd;
        })
        .map((t) => t.id);
      if (ids.length) {
        await sb.from("dispatch_targets").update(campos).in("id", ids);
        parados += ids.length;
      }
      continue;
    }

    if (chave.startsWith("email:")) {
      const { data } = await sb
        .from("email_targets")
        .select("id, email_campaigns!inner(user_id)")
        .eq("email_campaigns.user_id", userId)
        .in("status", EM_CADENCIA)
        .ilike("email", chave.slice(6));
      const ids = ((data ?? []) as { id: string }[]).map((t) => t.id);
      if (ids.length) {
        await sb.from("email_targets").update(campos).in("id", ids);
        parados += ids.length;
      }
      continue;
    }

    if (chave.startsWith("li:")) {
      const { data } = await sb
        .from("linkedin_targets")
        .select("id, linkedin_campaigns!inner(user_id)")
        .eq("linkedin_campaigns.user_id", userId)
        .in("status", EM_CADENCIA)
        .ilike("linkedin_url", `%/in/${chave.slice(3)}%`);
      const ids = ((data ?? []) as { id: string }[]).map((t) => t.id);
      if (ids.length) {
        await sb.from("linkedin_targets").update(campos).in("id", ids);
        parados += ids.length;
      }
    }
  }
  return parados;
}

/** Lead respondeu (webhook): para as cadências e leva o card pra "Respondeu". */
export async function registrarResposta(sb: SupabaseClient, userId: string, contatos: string[]): Promise<{ parados: number; movidos: number }> {
  const parados = await pararCadencias(sb, userId, contatos);
  const movidos = await moverCards(sb, userId, contatos, PAPEIS_PRE_RESPOSTA, "respondeu");
  return { parados, movidos };
}

/** Primeira mensagem saiu: card vai de "Novos leads" pra "Em cadência". */
export async function registrarPrimeiroContato(sb: SupabaseClient, userId: string, contatos: string[]): Promise<void> {
  await moverCards(sb, userId, contatos, ["entrada"], "cadencia");
}

/** Versão pra quem só tem a campanha em mãos (worker): resolve o dono e registra o primeiro contato. */
export async function primeiroContatoDaCampanha(
  sb: SupabaseClient,
  tabela: "dispatch_campaigns" | "email_campaigns" | "linkedin_campaigns",
  campaignId: string,
  contatos: (string | null)[],
): Promise<void> {
  const chaves = contatos.filter((c): c is string => Boolean(c));
  if (!chaves.length) return;
  const { data } = await sb.from(tabela).select("user_id").eq("id", campaignId).maybeSingle();
  const userId = (data as { user_id?: string } | null)?.user_id;
  if (userId) await registrarPrimeiroContato(sb, userId, chaves).catch(() => {});
}
