import { createAdminClient } from "@/lib/supabase/admin";
import { emTesteGratis } from "@/lib/teste-gratis-regras";
import { motivoBloqueio, type PerfilAcesso } from "@/lib/acesso-regras";
import { registrarAlertaAdmin } from "@/lib/alertas-admin";
import { dadosWebhookOficial } from "@/lib/integrations/whatsapp-oficial";
import {
  assinarCanal, cancelarCanal, configurarWebhookGlobal, consultarCanal, criarCanal, deletarCanal, ErroDatafy, gerarLinkConexao,
} from "@/lib/integrations/datafy-parceiro";
import type { Profile } from "@/lib/database.types";

/**
 * WhatsApp API oficial conectado pela própria pessoa (conta de parceiro da
 * Datafy, migration 0050):
 *
 * 1. "Conectar": cria o canal na Datafy (ou reaproveita um que ficou pela
 *    metade) e devolve o link da janela de conexão da Meta.
 * 2. A pessoa conecta o número na BM dela; a janela avisa a página, que
 *    pede a confirmação aqui. A confirmação consulta a Datafy (não confia no
 *    navegador) e só então ASSINA o canal: canal criado e nunca conectado
 *    não custa nada (a Datafy dá 2 dias de uso sem assinatura).
 * 3. Quem perde o recurso ou o acesso tem o canal cancelado pelo worker
 *    (tickCanaisOficiais); ao voltar, "Reativar" assina o mesmo canal de
 *    novo, sem reconectar o número.
 */

export class ErroCanalOficial extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

export interface CanalOficialRow {
  id: string;
  channel_id: string;
  user_id: string;
  instance_id: string | null;
  assinado: boolean;
  conectado_em: string | null;
  cancelado_em: string | null;
  criado_em: string;
}

export const MSG_SEM_RECURSO =
  "A API oficial do WhatsApp está inclusa nos planos Pro e Business. No Starter, ative o add-on WhatsApp API oficial em Planos e créditos.";

type PerfilOficial = PerfilAcesso & Pick<Profile, "id" | "email" | "whatsapp_oficial_habilitado">;

/** Quem pode ter um canal oficial ativo agora. */
export function podeUsarOficial(p: PerfilOficial | null | undefined): boolean {
  if (!p) return false;
  if (p.role === "admin") return true;
  if (emTesteGratis(p)) return false;
  if (p.acesso_ate !== undefined && motivoBloqueio(p)) return false;
  return Boolean(p.whatsapp_oficial_habilitado);
}

async function perfil(userId: string): Promise<PerfilOficial | null> {
  const { data } = await createAdminClient().from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as PerfilOficial | null) ?? null;
}

let webhookConfiguradoEm = 0;
/** O webhook global da conta aponta para a plataforma (refeito a cada 6 h por processo; a chamada substitui o anterior). */
async function garantirWebhookGlobal() {
  if (Date.now() - webhookConfiguradoEm < 6 * 3_600_000) return;
  const { url } = await dadosWebhookOficial();
  if (!url) return;
  try {
    await configurarWebhookGlobal(url);
    webhookConfiguradoEm = Date.now();
  } catch (err) {
    console.error("[whatsapp-oficial] não configurou o webhook global", (err as Error).message);
  }
}

async function assinarOuAvisar(canal: CanalOficialRow) {
  try {
    await assinarCanal(canal.channel_id);
  } catch (err) {
    const e = err as ErroDatafy;
    await registrarAlertaAdmin({
      chave: `datafy:assinar:${canal.channel_id}:${new Date().toISOString().slice(0, 10)}`,
      nivel: "critico",
      titulo: "Datafy: não foi possível ativar o canal de um cliente",
      mensagem: `O cliente conectou o número, mas a Datafy recusou a assinatura do canal ${canal.channel_id} (${e.message}). Confira a assinatura e o cartão da conta no painel da Datafy; o cliente pode clicar em "Verificar conexão" depois.`,
      link: "https://app.datafyapi.com.br",
    });
    throw new ErroCanalOficial(502, "O número foi conectado, mas não conseguimos ativar o canal agora. Nossa equipe já foi avisada; tente “Verificar conexão” em alguns minutos.");
  }
}

function soDigitos(telefone: string | null | undefined): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  return d || null;
}

/** "Conectar WhatsApp oficial": devolve o link da janela de conexão, ou reativa um canal já conectado. */
export async function iniciarConexaoOficial(userId: string): Promise<{ url: string; instanceId: string } | { reativado: true; numero: string | null }> {
  const p = await perfil(userId);
  if (!podeUsarOficial(p)) throw new ErroCanalOficial(403, MSG_SEM_RECURSO);
  const sb = createAdminClient();
  const { data } = await sb.from("datafy_canais").select("*").eq("user_id", userId).is("cancelado_em", null).order("criado_em", { ascending: false });
  const canais = (data ?? []) as CanalOficialRow[];

  // Já conectado: reativa (voltou a ter o recurso) ou avisa que já existe.
  const conectado = canais.find((c) => c.conectado_em);
  if (conectado && p!.role !== "admin") {
    if (conectado.assinado) throw new ErroCanalOficial(409, "Você já tem um número oficial conectado. Para trocar, remova o atual na lista de números.");
    await assinarOuAvisar(conectado);
    await sb.from("datafy_canais").update({ assinado: true }).eq("id", conectado.id);
    const { data: inst } = await sb
      .from("whatsapp_instances")
      .update({ status: "conectado" })
      .eq("id", conectado.instance_id ?? "")
      .select("numero_conectado")
      .maybeSingle();
    return { reativado: true, numero: (inst as { numero_conectado: string | null } | null)?.numero_conectado ?? null };
  }

  await garantirWebhookGlobal();

  // Canal que ficou pela metade (link expirado, janela fechada): reaproveita.
  let canal = canais.find((c) => !c.conectado_em && c.instance_id) ?? null;
  if (canal) {
    const situacao = await consultarCanal(canal.channel_id).catch(() => null);
    if (!situacao) canal = null;
    // Passou dos 2 dias sem assinatura: para conectar, o canal precisa estar ativo.
    else if (!situacao.subscribed && situacao.on_trial === false) {
      await assinarOuAvisar(canal);
      await sb.from("datafy_canais").update({ assinado: true }).eq("id", canal.id);
    }
  }

  if (!canal) {
    const criado = await criarCanal(`Leadmatic · ${p!.email}`, `Usuário ${userId}`);
    const { data: inst, error } = await sb
      .from("whatsapp_instances")
      .insert({ user_id: userId, nome: "WhatsApp oficial", canal: "oficial", status: "conectando", token_oficial: criado.token })
      .select("id")
      .single();
    if (error || !inst) {
      await deletarCanal(criado.id).catch(() => undefined);
      throw new ErroCanalOficial(500, "Não foi possível preparar o canal agora. Tente novamente.");
    }
    const { data: linha, error: erroLinha } = await sb
      .from("datafy_canais")
      .insert({ channel_id: criado.id, user_id: userId, instance_id: (inst as { id: string }).id })
      .select("*")
      .single();
    if (erroLinha || !linha) {
      await sb.from("whatsapp_instances").delete().eq("id", (inst as { id: string }).id);
      await deletarCanal(criado.id).catch(() => undefined);
      throw new ErroCanalOficial(500, "Não foi possível preparar o canal agora. Tente novamente.");
    }
    canal = linha as CanalOficialRow;
  }

  const { url } = await gerarLinkConexao(canal.channel_id);
  return { url, instanceId: canal.instance_id! };
}

/** Confere na Datafy se o número foi conectado; se foi, assina o canal e libera a instância. */
export async function confirmarConexaoOficial(userId: string, instanceId: string): Promise<{ conectado: boolean; numero: string | null }> {
  const sb = createAdminClient();
  const { data } = await sb.from("datafy_canais").select("*").eq("instance_id", instanceId).eq("user_id", userId).maybeSingle();
  const canal = data as CanalOficialRow | null;
  if (!canal) throw new ErroCanalOficial(404, "Canal não encontrado.");
  const p = await perfil(userId);
  if (!podeUsarOficial(p)) throw new ErroCanalOficial(403, MSG_SEM_RECURSO);

  const situacao = await consultarCanal(canal.channel_id);
  if (!situacao.phone_number_id) return { conectado: false, numero: null };

  if (!situacao.subscribed) await assinarOuAvisar(canal);
  const numero = soDigitos(situacao.phone);
  await sb
    .from("whatsapp_instances")
    .update({
      status: "conectado",
      phone_number_id: situacao.phone_number_id,
      waba_id: situacao.waba_id ?? null,
      numero_conectado: numero,
      ...(situacao.display_name ? { nome: `WhatsApp oficial · ${situacao.display_name}`.slice(0, 80) } : {}),
      ...(situacao.token ? { token_oficial: situacao.token } : {}),
    })
    .eq("id", instanceId);
  await sb
    .from("datafy_canais")
    .update({ assinado: true, conectado_em: canal.conectado_em ?? new Date().toISOString() })
    .eq("id", canal.id);
  return { conectado: true, numero };
}

/** Para de pagar o canal na Datafy (mantém a conexão do número para reativar depois). */
export async function cancelarCanalOficial(canal: CanalOficialRow): Promise<void> {
  try {
    await cancelarCanal(canal.channel_id);
  } catch (err) {
    const e = err as ErroDatafy;
    if (e.status !== 404) throw err;
  }
  const sb = createAdminClient();
  await sb.from("datafy_canais").update({ assinado: false }).eq("id", canal.id);
  if (canal.instance_id) await sb.from("whatsapp_instances").update({ status: "desconectado" }).eq("id", canal.instance_id);
}

/** A pessoa removeu o número: cancela e apaga o canal na Datafy. */
export async function removerCanalOficialDaInstancia(instanceId: string): Promise<void> {
  const sb = createAdminClient();
  const { data } = await sb.from("datafy_canais").select("*").eq("instance_id", instanceId).maybeSingle();
  const canal = data as CanalOficialRow | null;
  if (!canal) return;
  if (canal.assinado) await cancelarCanalOficial(canal).catch((e) => console.error("[whatsapp-oficial] cancelar", (e as Error).message));
  await deletarCanal(canal.channel_id).catch((e) => console.error("[whatsapp-oficial] apagar", (e as Error).message));
  await sb.from("datafy_canais").update({ cancelado_em: new Date().toISOString(), assinado: false, instance_id: null }).eq("id", canal.id);
}
