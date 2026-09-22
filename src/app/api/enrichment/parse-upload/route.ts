import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";

/** Parser de CSV simples, tolerante a campos entre aspas com vírgula/quebra
 * de linha dentro (formato usado por Excel/Google Sheets ao exportar CSV). */
function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentroAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroAspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile || !(profile.enriquecimento_ia_habilitado || profile.role === "admin")) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!arquivo || typeof arquivo === "string") {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const nome = arquivo.name || "";

  let linhas: string[][] = [];
  try {
    if (nome.toLowerCase().endsWith(".xlsx")) {
      const wb = new ExcelJS.Workbook();
      // Buffer.from(arrayBuffer) e o tipo `Buffer` que o exceljs declara
      // esperar divergem só na assinatura genérica (@types/node tornou
      // Buffer genérico e o .d.ts do exceljs não acompanhou) — o valor em
      // si é um Buffer real; eslint-disable local em vez de espalhar `any`.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any);
      const ws = wb.worksheets[0];
      if (!ws) return NextResponse.json({ error: "Planilha vazia." }, { status: 400 });
      ws.eachRow((row) => {
        const valores = (row.values as unknown[]).slice(1).map((v) => (v == null ? "" : String(v)));
        if (valores.some((v) => v.trim() !== "")) linhas.push(valores);
      });
    } else {
      linhas = parseCsv(buffer.toString("utf-8"));
    }
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o arquivo. Confira se é um CSV ou XLSX válido." }, { status: 400 });
  }

  if (linhas.length < 2) {
    return NextResponse.json({ error: "Arquivo sem linhas de dados (só cabeçalho ou vazio)." }, { status: 400 });
  }

  const colunas = linhas[0].map((c) => c.trim());
  const rows = linhas.slice(1).map((l) => {
    const obj: Record<string, string> = {};
    colunas.forEach((col, i) => {
      obj[col] = (l[i] ?? "").trim();
    });
    return obj;
  });

  return NextResponse.json({ colunas, rows });
}
