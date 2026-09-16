import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarLeadsDaPesquisa } from "@/lib/db";
import { exportarCsv, exportarExcel, nomeArquivo } from "@/lib/export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const { searchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: search } = await supabase
    .from("searches")
    .select("id, localidade")
    .eq("id", searchId)
    .single();
  if (!search) return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });

  const leads = await buscarLeadsDaPesquisa(supabase, searchId);
  const formato = new URL(request.url).searchParams.get("formato") === "csv" ? "csv" : "xlsx";
  const localidade = search.localidade || "leads";

  if (formato === "csv") {
    const csv = exportarCsv(leads);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo("prospeccao", localidade, "csv")}"`,
      },
    });
  }

  const buffer = await exportarExcel(leads);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo("prospeccao", localidade, "xlsx")}"`,
    },
  });
}
