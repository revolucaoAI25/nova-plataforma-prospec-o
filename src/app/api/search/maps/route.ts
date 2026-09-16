import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos } from "@/lib/credits";
import { resolverChaveMaps, registrarUsoChaveMaps } from "@/lib/maps-key";
import { resolverChaveApify, registrarUsoChaveApify } from "@/lib/apify-key";
import { buscarMaps, QuotaExceededError, MapsAccessError, type Stats } from "@/lib/integrations/google-maps";
import { buscarApifyMaps } from "@/lib/integrations/apify-maps";
import { NICHOS } from "@/lib/data/nichos";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes } from "@/lib/db";
import { autoExportarSheetsSeConfigurado } from "@/lib/auto-export";

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

  let avisoSaldo: string | null = null;
  let limite = filtros.limite;
  if (profile.maps_credits_enabled) {
    const saldo = profile.maps_credits;
    if (saldo <= 0) {
      return NextResponse.json({ error: "Você não tem créditos Google Maps disponíveis. Solicite mais ao administrador." }, { status: 402 });
    }
    if (saldo < limite) {
      avisoSaldo = `Você tem ${saldo} créditos Maps — a busca considerou esse teto em vez dos ${limite} solicitados.`;
      limite = saldo;
    }
  }

  const resolucao = await resolverChaveMaps(profile);
  const apifyResolucao = resolverChaveApify(profile);
  // Fallback Apify: só bloqueia de vez se o pool Maps esgotou E não há
  // nenhuma chave Apify disponível — mesma regra do scheduler de automações.
  if ((resolucao.bloqueado || !resolucao.key) && !apifyResolucao.key) {
    if (resolucao.bloqueado) {
      return NextResponse.json(
        { error: "Todas as chaves Google Maps atingiram o limite mensal. Mude a preferência em Configurações se quiser continuar além da cota." },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "Nenhuma chave Google Maps ou Apify configurada." }, { status: 400 });
  }

  let excludeTels = new Set<string>();
  if (filtros.apenasNovos) {
    const existentes = await buscarIdentificadoresExistentes(supabase, user.id);
    excludeTels = existentes.telefones;
  }

  const stats: Stats = { text_search_calls: 0, contact_data_calls: 0 };
  let resultados;
  let usouApify = false;
  const buscarComGoogle = !resolucao.bloqueado && Boolean(resolucao.key);

  try {
    if (buscarComGoogle) {
      try {
        resultados = await buscarMaps({
          queryBase,
          localidade: filtros.localidades,
          limite,
          apiKey: resolucao.key,
          nicho: filtros.nicho || queryBase,
          subnicho: filtros.subnicho,
          excludePhones: excludeTels,
          showPhone: filtros.showPhone,
          showRating: filtros.showRating,
          stats,
        });
      } catch (e) {
        await registrarUsoChaveMaps(supabase, user.id, profile, resolucao, stats.contact_data_calls, stats.text_search_calls);
        if (e instanceof QuotaExceededError && apifyResolucao.key) {
          usouApify = true;
          resultados = await buscarApifyMaps({
            queryBase,
            localidade: filtros.localidades,
            limite,
            apiKey: apifyResolucao.key,
            nicho: filtros.nicho || queryBase,
            subnicho: filtros.subnicho,
            excludePhones: excludeTels,
            showPhone: filtros.showPhone,
            showRating: filtros.showRating,
          });
        } else {
          throw e;
        }
      }
    } else {
      usouApify = true;
      resultados = await buscarApifyMaps({
        queryBase,
        localidade: filtros.localidades,
        limite,
        apiKey: apifyResolucao.key,
        nicho: filtros.nicho || queryBase,
        subnicho: filtros.subnicho,
        excludePhones: excludeTels,
        showPhone: filtros.showPhone,
        showRating: filtros.showRating,
      });
    }
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    if (e instanceof MapsAccessError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Ocorreu um erro inesperado na busca. Tente novamente." }, { status: 500 });
  }

  if (!usouApify) {
    const contactDataCalls = filtros.showPhone ? resultados.length : stats.contact_data_calls;
    await registrarUsoChaveMaps(supabase, user.id, profile, resolucao, contactDataCalls, stats.text_search_calls);
  } else if (apifyResolucao.source === "pool") {
    await registrarUsoChaveApify(supabase, user.id, profile, apifyResolucao, resultados.length);
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

  // Só cobra créditos Maps da plataforma se o Google Maps foi de fato usado —
  // no fallback Apify (chave pessoal do usuário), o custo é dele, não da plataforma.
  if (profile.maps_credits_enabled && !usouApify) {
    await debitarCreditos(supabase, user.id, "maps_credits", resultados.length);
  }

  const avisoApify = usouApify ? "Cota do Google Maps esgotada — esta busca usou o Apify como alternativa." : null;
  const avisoSheets = await autoExportarSheetsSeConfigurado(supabase, user.id, searchId);

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    avisos: [avisoSaldo, avisoApify, avisoHistorico, avisoSheets].filter(Boolean),
  });
}
