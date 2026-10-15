import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { localizarEndereco } from "@/lib/geocodificacao";

export const maxDuration = 45;

/** Confere o endereço da busca por raio do Google Maps antes de buscar: devolve o ponto e como ele foi entendido. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 3) return NextResponse.json({ error: "Digite um endereço." }, { status: 400 });
  const ponto = await localizarEndereco(q);
  if (!ponto) return NextResponse.json({ error: "Não encontramos esse endereço. Tente com a cidade junto (ex.: Av. Industrial, Santo André)." }, { status: 404 });
  return NextResponse.json(ponto);
}
