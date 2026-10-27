import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterTemplateDb, atualizarTemplateDb, deletarTemplateDb, obterInstancia } from "@/lib/dispatch-db";
import { obterTemplate as obterTemplateMeta } from "@/lib/integrations/whatsapp-oficial";
import { enviarTemplateParaMeta } from "@/lib/templates-oficial";

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
    const motivo = meta.rejected_reason && meta.rejected_reason !== "NONE" ? String(meta.rejected_reason) : undefined;
    return NextResponse.json({ template: { ...template, status_aprovacao: status || template.status_aprovacao }, motivo });
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
  const r = await enviarTemplateParaMeta(supabase, template);
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status });
  return NextResponse.json({ ok: true, metaTemplateId: r.metaTemplateId });
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
