import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Única credencial que o próprio usuário configura: a chave da OpenAI
// (enriquecimento via IA roda na conta dele). O resto das chaves de
// fornecedor é da plataforma — ver src/lib/platform-keys.ts.
const bodySchema = z.object({
  openai_api_key: z.string().nullable(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const { error } = await supabase
    .from("profiles")
    .update({ openai_api_key: parsed.data.openai_api_key?.trim() || null })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
