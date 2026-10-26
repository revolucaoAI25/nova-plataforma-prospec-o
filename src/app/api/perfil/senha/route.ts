import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as clienteSemSessao } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dentroDoLimite } from "@/lib/limite-tentativas";

/**
 * Troca de senha de quem está logado (Meu perfil). Pede a senha atual: uma
 * sessão aberta num computador emprestado não basta para trocar a senha.
 * Depois da troca, as sessões em outros aparelhos são encerradas.
 */

const schema = z.object({
  atual: z.string().min(1, "Informe a sua senha atual."),
  nova: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres.").max(72, "A senha pode ter no máximo 72 caracteres."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  if (!dentroDoLimite(`trocar-senha:${user.id}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Confira os dados." }, { status: 400 });
  const { atual, nova } = parsed.data;
  if (atual === nova) return NextResponse.json({ error: "A nova senha precisa ser diferente da atual." }, { status: 400 });

  // Confere a senha atual num cliente à parte, sem mexer na sessão do navegador.
  const conferencia = clienteSemSessao(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: erroAtual } = await conferencia.auth.signInWithPassword({ email: user.email, password: atual });
  if (erroAtual) return NextResponse.json({ error: "A senha atual não confere." }, { status: 400 });
  await conferencia.auth.signOut({ scope: "local" }).catch(() => undefined);

  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password: nova });
  if (error) {
    console.error("[perfil/senha] falha ao trocar a senha", error.message);
    return NextResponse.json({ error: "Não foi possível trocar a senha. Tente outra senha." }, { status: 400 });
  }
  await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
