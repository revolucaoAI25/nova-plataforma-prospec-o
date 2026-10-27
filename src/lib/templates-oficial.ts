import type { SupabaseClient } from "@supabase/supabase-js";
import { atualizarTemplateDb, obterInstancia } from "@/lib/dispatch-db";
import { criarTemplate as criarTemplateMeta } from "@/lib/integrations/whatsapp-oficial";
import type { MessageTemplateRow } from "@/lib/database.types";

type Componente = { type?: string; text?: string; example?: { body_text?: string[][]; header_text?: string[] } };

/** Envia um template (rascunho ou reprovado) para a análise da Meta, com os exemplos das variáveis. */
export async function enviarTemplateParaMeta(
  sb: SupabaseClient,
  template: MessageTemplateRow,
): Promise<{ ok: true; metaTemplateId: string } | { ok: false; erro: string; status: number }> {
  if (!template.instance_id) return { ok: false, erro: "Template sem número vinculado.", status: 400 };
  const instancia = await obterInstancia(sb, template.instance_id);
  if (!instancia?.token_oficial || !instancia.waba_id) {
    return { ok: false, erro: "O número oficial ainda não terminou de conectar (falta a conta do WhatsApp Business). Confira em Números.", status: 400 };
  }
  if (!template.nome_meta) return { ok: false, erro: "Informe o nome do template na Meta.", status: 400 };

  const componentes = ((template.componentes as Componente[] | null) ?? []);
  const header = componentes.find((c) => c.type === "HEADER");
  const footer = componentes.find((c) => c.type === "FOOTER");
  const body = componentes.find((c) => c.type === "BODY");
  try {
    const resp = await criarTemplateMeta(
      instancia.token_oficial, instancia.waba_id, template.nome_meta, template.categoria || "MARKETING",
      template.idioma || "pt_BR", template.corpo, String(header?.text || ""), String(footer?.text || ""),
      { corpo: body?.example?.body_text?.[0], cabecalho: header?.example?.header_text?.[0] },
    );
    const status = String(resp.status || "pending").toLowerCase();
    await atualizarTemplateDb(sb, template.id, { meta_template_id: resp.id, status_aprovacao: status });
    return { ok: true, metaTemplateId: resp.id };
  } catch (e) {
    return { ok: false, erro: (e as Error).message, status: 502 };
  }
}
