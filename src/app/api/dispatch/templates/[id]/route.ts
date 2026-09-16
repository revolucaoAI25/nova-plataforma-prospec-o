import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterTemplateDb, atualizarTemplateDb, deletarTemplateDb, obterInstancia } from "@/lib/dispatch-db";
import { criarTemplate as criarTemplateMeta, obterTemplate as obterTemplateMeta } from "@/lib/integrations/whatsapp-oficial";

/** Reconsulta o status de aprovação na Meta. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const template = await obterTemplateDb(supabase, id);
  if (!template) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
  if (!template.meta_template_id || !template.instance_id) return NextResponse.json({ template });

  const instancia = await obterInstancia(supabase, template.instance_id);
  if (!instancia?.token_oficial) return NextResponse.json({ template });

  try {
    const meta = await obterTemplateMeta(instancia.token_oficial, template.meta_template_id);
    const status = String(meta.status || "").toLowerCase();
    if (status && status !== template.status_aprovacao) {
      await atualizarTemplateDb(supabase, id, { status_aprovacao: status });
    }
    return NextResponse.json({ template: { ...template, status_aprovacao: status || template.status_aprovacao } });
  } catch {
    return NextResponse.json({ template });
  }
}

/** Envia o template (ainda rascunho) para aprovação da Meta. */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const template = await obterTemplateDb(supabase, id);
  if (!template) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
  if (!template.instance_id) return NextResponse.json({ error: "Template sem instância vinculada." }, { status: 400 });

  const instancia = await obterInstancia(supabase, template.instance_id);
  if (!instancia?.token_oficial || !instancia.waba_id) {
    return NextResponse.json({ error: "Instância oficial sem WABA ID configurado." }, { status: 400 });
  }
  if (!template.nome_meta) {
    return NextResponse.json({ error: "Informe o nome do template na Meta (minúsculo, com underscore) antes de enviar." }, { status: 400 });
  }

  try {
    const componentes = (template.componentes as Array<Record<string, unknown>>) || [];
    const header = componentes.find((c) => c.type === "HEADER");
    const footer = componentes.find((c) => c.type === "FOOTER");
    const resp = await criarTemplateMeta(
      instancia.token_oficial, instancia.waba_id, template.nome_meta, template.categoria || "MARKETING",
      template.idioma || "pt_BR", template.corpo, String(header?.text || ""), String(footer?.text || ""),
    );
    await atualizarTemplateDb(supabase, id, { meta_template_id: resp.id, status_aprovacao: "pending" });
    return NextResponse.json({ ok: true, metaTemplateId: resp.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const ok = await deletarTemplateDb(supabase, id);
  if (!ok) return NextResponse.json({ error: "Não foi possível remover o template." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
