import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listarTemplatesDb, criarTemplateDb, obterTemplateDb, perfilComDisparoHabilitado, instanciaPertenceAoUsuario } from "@/lib/dispatch-db";
import { extrairParametrosTemplate, nomeMetaDe, problemasTemplate } from "@/lib/dispatch-template-shared";
import { enviarTemplateParaMeta } from "@/lib/templates-oficial";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const templates = await listarTemplatesDb(supabase, user.id);
  return NextResponse.json({ templates });
}

const bodySchema = z.object({
  instanceId: z.string().uuid(),
  nome: z.string().min(1),
  categoria: z.string().min(1),
  corpo: z.string().min(1),
  nomeMeta: z.string().optional(),
  idioma: z.string().default("pt_BR"),
  cabecalho: z.string().optional(),
  rodape: z.string().optional(),
  variaveis: z.array(z.string()).optional(),
  exemplos: z.array(z.string().max(200)).optional(),
  exemploCabecalho: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await perfilComDisparoHabilitado(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Disparo não habilitado para sua conta." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });

  if (!(await instanciaPertenceAoUsuario(supabase, parsed.data.instanceId, profile))) {
    return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });
  }

  const dados = { ...parsed.data, nomeMeta: parsed.data.nomeMeta?.trim() || nomeMetaDe(parsed.data.nome) };
  const problemas = problemasTemplate({
    nomeMeta: dados.nomeMeta, corpo: dados.corpo, cabecalho: dados.cabecalho, rodape: dados.rodape,
    exemplos: dados.exemplos ?? [], exemploCabecalho: dados.exemploCabecalho,
  });
  if (problemas.length) return NextResponse.json({ error: problemas.join(" ") }, { status: 400 });

  const id = await criarTemplateDb(supabase, user.id, { ...dados, variaveis: extrairParametrosTemplate(dados.corpo).map(String) });
  if (!id) return NextResponse.json({ error: "Não foi possível criar o template." }, { status: 500 });

  // Já manda para a análise da Meta; se ela recusar, o template fica como rascunho para tentar de novo.
  const template = await obterTemplateDb(supabase, id);
  const envio = template ? await enviarTemplateParaMeta(supabase, template) : null;
  if (envio && !envio.ok) return NextResponse.json({ id, enviado: false, aviso: envio.erro }, { status: 201 });
  return NextResponse.json({ id, enviado: Boolean(envio?.ok) }, { status: 201 });
}
