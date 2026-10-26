import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Registra que a pessoa viu (ou pulou) o tour guiado — o campo é protegido, então quem grava é o servidor. */
const schema = z.object({ publico: z.enum(["teste", "assinante"]) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tour inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("tour_visto").eq("id", user.id).maybeSingle();
  const atual = ((data as { tour_visto?: Record<string, string> } | null)?.tour_visto ?? {}) as Record<string, string>;
  if (!atual[parsed.data.publico]) {
    const { error } = await admin
      .from("profiles")
      .update({ tour_visto: { ...atual, [parsed.data.publico]: new Date().toISOString() } })
      .eq("id", user.id);
    if (error) console.error("[perfil/tour] não gravou", error.message);
  }
  return NextResponse.json({ ok: true });
}
