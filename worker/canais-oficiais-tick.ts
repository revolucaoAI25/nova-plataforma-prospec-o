/**
 * Canais do WhatsApp oficial (Datafy, migration 0050) que a plataforma paga:
 * - assinados de quem perdeu o recurso (cancelou o add-on, saiu do plano)
 *   ou o acesso (plano encerrado, pagamento recusado): a assinatura do canal
 *   é cancelada (a conexão do número fica, para reativar depois);
 * - conectados fora da página (link enviado ao cliente, janela fechada antes
 *   do aviso): confirmados aqui, consultando a Datafy;
 * - criados pela plataforma e nunca conectados há mais de 3 dias: apagados
 *   na Datafy (os criados no painel da Datafy e vinculados pelo admin ficam).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelarCanalOficial, confirmarConexaoOficial, podeUsarOficial, type CanalOficialRow } from "../src/lib/whatsapp-oficial-canal";
import {
  cancelarCanal, consultarCanal, deletarCanal, ErroDatafy, parceiroDatafyConfigurado, PREFIXO_DESCRICAO_PLATAFORMA,
} from "../src/lib/integrations/datafy-parceiro";

export async function tickCanaisOficiais(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  if (!(await parceiroDatafyConfigurado())) return;
  const { data, error } = await sb.from("datafy_canais").select("*").is("cancelado_em", null);
  if (error) {
    // Sem a migration 0050 ainda não há canais.
    if (!/datafy_canais/.test(error.message)) log(`erro ao listar canais: ${error.message}`);
    return;
  }
  const canais = (data ?? []) as CanalOficialRow[];
  if (!canais.length) return;

  const assinados = canais.filter((c) => c.assinado);
  if (assinados.length) {
    const { data: perfis } = await sb.from("profiles").select("*").in("id", [...new Set(assinados.map((c) => c.user_id))]);
    const porId = new Map(((perfis ?? []) as { id: string }[]).map((p) => [p.id, p]));
    for (const canal of assinados) {
      if (podeUsarOficial(porId.get(canal.user_id) as Parameters<typeof podeUsarOficial>[0])) continue;
      try {
        await cancelarCanalOficial(canal);
        log(`canal ${canal.channel_id} cancelado (o dono não tem mais o recurso)`);
      } catch (e) {
        log(`não cancelou o canal ${canal.channel_id}: ${(e as Error).message}`);
      }
    }
  }

  const limite = Date.now() - 3 * 86_400_000;
  // Sem prazo: os canais do painel da Datafy vinculados pelo admin nunca são apagados.
  for (const canal of canais.filter((c) => !c.conectado_em && c.instance_id)) {
    try {
      const situacao = await consultarCanal(canal.channel_id);
      if (!situacao.phone_number_id) continue;
      await confirmarConexaoOficial(canal.user_id, canal.instance_id!, { porAdmin: true });
      log(`canal ${canal.channel_id} conectado (confirmado pelo worker)`);
    } catch (e) {
      log(`não confirmou o canal ${canal.channel_id}: ${(e as Error).message}`);
    }
  }

  for (const canal of canais.filter((c) => !c.conectado_em && new Date(c.criado_em).getTime() < limite)) {
    try {
      // Só apaga o que a plataforma criou; o canal do painel da Datafy vinculado pelo admin fica,
      // mesmo sem conectar. Falha na consulta: tenta no próximo ciclo (404 = já não existe).
      const situacao = await consultarCanal(canal.channel_id).catch((e: ErroDatafy) => (e.status === 404 ? null : undefined));
      if (situacao === undefined) continue;
      if (situacao && !(situacao.description ?? "").startsWith(PREFIXO_DESCRICAO_PLATAFORMA)) continue;
      if (canal.assinado) await cancelarCanal(canal.channel_id).catch(() => undefined);
      await deletarCanal(canal.channel_id).catch(() => undefined);
      if (canal.instance_id) await sb.from("whatsapp_instances").delete().eq("id", canal.instance_id).eq("status", "conectando");
      await sb.from("datafy_canais").update({ cancelado_em: new Date().toISOString(), assinado: false }).eq("id", canal.id);
      log(`canal ${canal.channel_id} nunca conectado foi removido`);
    } catch (e) {
      log(`não removeu o canal ${canal.channel_id}: ${(e as Error).message}`);
    }
  }
}
