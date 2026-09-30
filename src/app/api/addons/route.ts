import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/credits";
import { listarAddonsAtivos, listarAssinaturasAddonsDoUsuario } from "@/lib/addons-db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  const [addons, assinaturas] = await Promise.all([
    listarAddonsAtivos(supabase),
    listarAssinaturasAddonsDoUsuario(supabase, user.id),
  ]);
  return NextResponse.json({ addons, assinaturas });
}
