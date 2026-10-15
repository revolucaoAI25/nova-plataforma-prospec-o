import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodificar } from "@/lib/geocodificacao";
import { emParalelo } from "@/lib/paralelo";

export const maxDuration = 60;

const CAMPOS = "id, cnpj, nome, telefone, endereco, bairro, municipio, uf, cidade_busca, estado_busca, avaliacao, total_avaliacoes, site, latitude, longitude, geo_precisao";
// Por chamada: o navegador vai pedindo lotes até acabar e o mapa enche aos poucos.
const LOTE_GEOCODIFICACAO = 30;

interface LinhaMapa {
  id: string;
  cnpj: string | null;
  nome: string | null;
  telefone: string | null;
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cidade_busca: string | null;
  estado_busca: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
  site: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_precisao: string | null;
}

interface PontoMapa {
  id: string;
  nome: string | null;
  telefone: string | null;
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  avaliacao: number | null;
  totalAvaliacoes: number | null;
  site: string | null;
  lat: number | null;
  lng: number | null;
  precisao: string | null;
}

function paraPonto(l: LinhaMapa): PontoMapa {
  return {
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    endereco: l.endereco,
    bairro: l.bairro,
    municipio: l.municipio || l.cidade_busca,
    uf: l.uf || l.estado_busca,
    avaliacao: l.avaliacao,
    totalAvaliacoes: l.total_avaliacoes,
    site: l.site,
    lat: l.latitude,
    lng: l.longitude,
    precisao: l.geo_precisao,
  };
}

async function contexto(searchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  // RLS: só acha a pesquisa se ela for da pessoa.
  const { data: search } = await supabase.from("searches").select("id").eq("id", searchId).maybeSingle();
  if (!search) return { erro: NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 }) };
  return { supabase };
}

/** Uma empresa = um ponto (com "vários sócios", cada sócio é um lead da mesma empresa). */
function umPorEmpresa(linhas: LinhaMapa[]): LinhaMapa[] {
  const vistos = new Set<string>();
  return linhas.filter((l) => {
    const chave = l.cnpj?.replace(/\D/g, "") || l.id;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

async function contarPendentes(supabase: Awaited<ReturnType<typeof createClient>>, searchId: string) {
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("search_id", searchId).is("geo_precisao", null);
  return count ?? 0;
}

/** Pontos da pesquisa e quantos ainda faltam localizar. */
export async function GET(_request: Request, { params }: { params: Promise<{ searchId: string }> }) {
  const { searchId } = await params;
  const ctx = await contexto(searchId);
  if ("erro" in ctx) return ctx.erro;
  const { data } = await ctx.supabase.from("leads").select(CAMPOS).eq("search_id", searchId).limit(5000);
  return NextResponse.json({
    pontos: umPorEmpresa((data ?? []) as LinhaMapa[]).map(paraPonto),
    pendentes: await contarPendentes(ctx.supabase, searchId),
  });
}

/** Localiza o próximo lote de leads sem coordenada e devolve os pontos atualizados. */
export async function POST(_request: Request, { params }: { params: Promise<{ searchId: string }> }) {
  const { searchId } = await params;
  const ctx = await contexto(searchId);
  if ("erro" in ctx) return ctx.erro;

  const { data } = await ctx.supabase
    .from("leads").select(CAMPOS).eq("search_id", searchId).is("geo_precisao", null).limit(LOTE_GEOCODIFICACAO);
  const linhas = umPorEmpresa((data ?? []) as LinhaMapa[]);
  const cache = createAdminClient();

  // Para de começar endereços novos perto do limite da requisição; o que
  // sobrar vai no próximo lote.
  const prazo = Date.now() + 35_000;
  const resultados = await emParalelo(linhas, 4, async (l) => {
    if (Date.now() > prazo) return null;
    const c = await geocodificar(cache, {
      endereco: l.endereco,
      bairro: l.bairro,
      municipio: l.municipio || l.cidade_busca,
      uf: l.uf || l.estado_busca,
    });
    // Grava em todos os leads da mesma empresa na pesquisa (um por sócio).
    const alvo = ctx.supabase.from("leads").update({ latitude: c.latitude, longitude: c.longitude, geo_precisao: c.precisao });
    await (l.cnpj ? alvo.eq("search_id", searchId).eq("cnpj", l.cnpj) : alvo.eq("id", l.id));
    return paraPonto({ ...l, latitude: c.latitude, longitude: c.longitude, geo_precisao: c.precisao });
  });

  const atualizados = resultados.filter((p): p is PontoMapa => p !== null);
  return NextResponse.json({ pontos: atualizados, pendentes: await contarPendentes(ctx.supabase, searchId) });
}
