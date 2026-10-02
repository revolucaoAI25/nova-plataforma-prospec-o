import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos, custoAcao } from "@/lib/credits";
import { chaveApify } from "@/lib/platform-keys";
import { buscarApifyMaps } from "@/lib/integrations/apify-maps";
import { NICHOS } from "@/lib/data/nichos";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes } from "@/lib/db";
import { autoExportarSheetsSeConfigurado } from "@/lib/auto-export";
import { emTesteGratis, MSG_TESTE_GRATIS_SEM_CREDITOS } from "@/lib/teste-gratis";

const bodySchema = z.object({
  nicho: z.string().default(""),
  queryCustom: z.string().default(""),
  subnicho: z.string().default(""),
  localidades: z.array(z.string()).min(1),
  limite: z.number().int().min(1).max(500).default(60),
  showPhone: z.boolean().default(true),
  showRating: z.boolean().default(true),
  apenasNovos: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Filtros inválidos.", detalhes: parsed.error.flatten() }, { status: 400 });
  }
  const filtros = parsed.data;

  const nichoInfo = NICHOS[filtros.nicho];
  const queryBase = (nichoInfo?.query || filtros.queryCustom).trim();
  if (!queryBase) {
    return NextResponse.json({ error: "Informe um nicho (ou um termo de busca personalizado)." }, { status: 400 });
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  // Diferente do CNPJ (que reduz o limite ao saldo disponível), a busca
  // Maps bloqueia de vez quando o saldo é insuficiente — mesmo comportamento
  // do produto atual (app.py, `_maps_err` antes do `buscar_btn`).
  const limite = filtros.limite;
  const custo = await custoAcao(supabase, "maps");
  const saldo = profile.creditos;
  if (saldo < limite * custo && emTesteGratis(profile)) {
    return NextResponse.json({ error: MSG_TESTE_GRATIS_SEM_CREDITOS }, { status: 402 });
  }
  if (saldo < limite * custo) {
    return NextResponse.json(
      { error: `Créditos insuficientes. Você tem ${saldo} créditos e essa busca pode custar até ${limite * custo}. Reduza o limite ou adquira mais créditos.` },
      { status: 402 },
    );
  }

  const apiKey = await chaveApify();
  if (!apiKey) {
    return NextResponse.json({ error: "A busca no Google Maps está temporariamente indisponível. Tente novamente mais tarde." }, { status: 503 });
  }

  let excludeTels = new Set<string>();
  if (filtros.apenasNovos) {
    const existentes = await buscarIdentificadoresExistentes(supabase, user.id);
    excludeTels = existentes.telefones;
  }

  let resultados;
  try {
    resultados = await buscarApifyMaps({
      queryBase,
      localidade: filtros.localidades,
      limite,
      apiKey,
      nicho: filtros.nicho || queryBase,
      subnicho: filtros.subnicho,
      excludePhones: excludeTels,
      showPhone: filtros.showPhone,
      showRating: filtros.showRating,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const localidade = filtros.localidades.join(", ");
  const searchId = await salvarPesquisa(supabase, user.id, {
    fonte: "google_maps",
    nicho: filtros.nicho || queryBase,
    subnicho: filtros.subnicho,
    cidade: "",
    estado: "",
    localidade,
    totalResults: resultados.length,
    filtros,
  });

  let avisoHistorico: string | null = null;
  if (!searchId) {
    avisoHistorico = "Os resultados foram encontrados, mas não foi possível salvá-los no Histórico. Exporte agora antes de sair desta tela.";
  } else if (!(await salvarLeads(supabase, user.id, searchId, resultados))) {
    avisoHistorico = "Os resultados foram encontrados, mas não foi possível salvá-los no Histórico. Exporte agora antes de sair desta tela.";
  }

  await debitarCreditos(supabase, user.id, "maps", resultados.length);

  const avisoSheets = await autoExportarSheetsSeConfigurado(supabase, user.id, searchId);

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    avisos: [avisoHistorico, avisoSheets].filter(Boolean),
  });
}
