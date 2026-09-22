import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportarEnrichmentCsv, exportarEnrichmentExcel, nomeArquivo } from "@/lib/export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: leads } = await supabase
    .from("enrichment_leads")
    .select("*")
    .eq("run_id", id)
    .order("created_at", { ascending: true });
  if (!leads) return NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });

  const formato = new URL(request.url).searchParams.get("formato") === "csv" ? "csv" : "xlsx";

  if (formato === "csv") {
    const csv = exportarEnrichmentCsv(leads);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo("enriquecimento_leads", "ia", "csv")}"`,
      },
    });
  }

  const buffer = await exportarEnrichmentExcel(leads);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo("enriquecimento_leads", "ia", "xlsx")}"`,
    },
  });
}
