import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos } from "@/lib/credits";
import { resolverChaveMaps, resolverChaveMapsOverflow, registrarUsoChaveMaps } from "@/lib/maps-key";
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

  // Diferente do CNPJ (que reduz o limite ao saldo disponível), a busca
  // Maps bloqueia de vez quando o saldo é insuficiente — mesmo comportamento
  // do produto atual (app.py, `_maps_err` antes do `buscar_btn`).
  const limite = filtros.limite;
  if (profile.maps_credits_enabled) {
    const saldo = profile.maps_credits;
    if (saldo < limite) {
      return NextResponse.json(
        { error: `Créditos Maps insuficientes. Você tem ${saldo} créditos e a busca requer ${limite}. Solicite mais créditos ao administrador.` },
        { status: 402 },
      );
    }
  }

  let resolucao = await resolverChaveMaps(profile);
  const apifyResolucao = resolverChaveApify(profile);
  // Fallback Apify: só bloqueia de vez se o pool Maps esgotou E não há
  // nenhuma chave Apify disponível — mesma regra do scheduler de automações.
  // Só depois de Apify também falhar é que se tenta estourar o limite do
  // pool Maps (overflow), igual à ordem do produto atual.
  if ((resolucao.bloqueado || !resolucao.key) && !apifyResolucao.key) {
    const overflow = await resolverChaveMapsOverflow(profile);
    if (overflow.key) {
      resolucao = overflow;
    } else {
      return NextResponse.json(
        resolucao.bloqueado
          ? { error: "Todas as chaves Google Maps atingiram o limite mensal. Mude a preferência em Configurações se quiser continuar além da cota." }
          : { error: "Nenhuma chave Google Maps ou Apify configurada." },
        { status: resolucao.bloqueado ? 402 : 400 },
      );
    }
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
        // Uso parcial de Maps NÃO é registrado no pool quando cai no fallback
        // Apify — mesmo comportamento do produto atual (app.py só chama
        // registrar_uso_maps no caminho 100% bem-sucedido só-Maps; o
        // contador do pool não é penalizado por uma tentativa que acabou
        // resolvida por outro recurso).
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
    // Contador visível sempre pelo total de resultados (mesma fórmula do
    // produto atual, app.py: `registrar_uso_maps(_pool_ativo, _pool_key_idx,
    // len(res), ...)` — não é condicionado a showPhone).
    await registrarUsoChaveMaps(supabase, user.id, profile, resolucao, resultados.length, stats.text_search_calls);
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

  // Cobra créditos Maps da plataforma sempre que o Google Maps foi usado OU
  // quando o fallback Apify veio do pool administrado pela plataforma — só
  // NÃO cobra quando o fallback Apify usou a chave pessoal do usuário (nesse
  // caso o custo é dele, não da plataforma). Mesma regra de app.py
  // (`_apify_platform_used`), que fica implícita aqui em `source === "pool"`.
  if (profile.maps_credits_enabled && resultados.length > 0 && (!usouApify || apifyResolucao.source === "pool")) {
    await debitarCreditos(supabase, user.id, "maps_credits", resultados.length);
  }

  const avisoApify = usouApify ? "Cota do Google Maps esgotada — esta busca usou o Apify como alternativa." : null;
  const avisoSheets = await autoExportarSheetsSeConfigurado(supabase, user.id, searchId);

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    avisos: [avisoApify, avisoHistorico, avisoSheets].filter(Boolean),
  });
}
