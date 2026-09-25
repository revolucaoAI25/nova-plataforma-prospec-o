import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarSheetWatcherEmail, atualizarCampanhaEmail } from "@/lib/email-dispatch-db";

const bodySchema = z.object({
  sheetId: z.string().min(1),
  abaNome: z.string().min(1),
  colunaEmail: z.string().min(1),
  colunaNome: z.string().optional(),
});

/** Configura o monitoramento de uma planilha Google — novas linhas viram alvos automaticamente. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const watcherId = await criarSheetWatcherEmail(supabase, id, parsed.data);
  if (!watcherId) return NextResponse.json({ error: "Não foi possível configurar o monitoramento." }, { status: 500 });

  await atualizarCampanhaEmail(supabase, id, { tipo_origem: "sheet_watch" });
  return NextResponse.json({ id: watcherId }, { status: 201 });
}
