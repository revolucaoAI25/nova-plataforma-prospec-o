import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cidadesVizinhas, RAIO_VIZINHOS_MAX_KM } from "@/lib/vizinhos";

/** Prévia de "incluir cidades vizinhas" na busca por CNPJ: quais municípios entram com esse raio. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const lista = (nome: string) => (url.searchParams.get(nome) ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const km = Math.min(Math.max(Number(url.searchParams.get("km")) || 0, 0), RAIO_VIZINHOS_MAX_KM);
  return NextResponse.json(cidadesVizinhas(lista("cidades").slice(0, 20), lista("ufs"), km));
}
