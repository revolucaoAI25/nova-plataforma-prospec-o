import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterRunBigDataCorp, listarLeadsRunBigDataCorp } from "@/lib/bigdatacorp-enrichment-db";
import { csvDeTabela, excelDeTabela, nomeArquivo, tabelaSociosContato } from "@/lib/export";

/** Download do resultado de "Sócios e Contato" (celular do sócio): Excel (padrão) ou CSV. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // RLS: só acha a execução se ela for da pessoa.
  const run = await obterRunBigDataCorp(supabase, id);
  if (!run) return NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });
  const tabela = tabelaSociosContato(await listarLeadsRunBigDataCorp(supabase, id));

  if (new URL(request.url).searchParams.get("formato") === "csv") {
    return new NextResponse(csvDeTabela(tabela), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo("socios_contato", "celular", "csv")}"`,
      },
    });
  }
  const buffer = await excelDeTabela(tabela, "Sócios e contato");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo("socios_contato", "celular", "xlsx")}"`,
    },
  });
}
