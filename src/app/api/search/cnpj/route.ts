import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos } from "@/lib/credits";
import { resolverChaveMaps, registrarUsoChaveMaps } from "@/lib/maps-key";
import {
  buscarCnpj,
  removerDuplicadosLote,
  CasaDosDadosError,
  type BuscaTextual,
} from "@/lib/integrations/casa-dos-dados";
import { enriquecerComMaps, QuotaExceededError, MapsAccessError } from "@/lib/integrations/google-maps";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes } from "@/lib/db";
import { CODIGO_PARA_DESC } from "@/lib/data/cnaes";

const bodySchema = z.object({
  cnaes: z.array(z.string()),
  uf: z.array(z.string()).min(1),
  municipio: z.array(z.string()).default([]),
  porte: z.array(z.string()).default([]),
  matrizFilial: z.enum(["", "MATRIZ", "FILIAL"]).default(""),
  simplesOptante: z.boolean().nullable().default(null),
  excluirSimples: z.boolean().default(false),
  meiOptante: z.boolean().nullable().default(null),
  excluirMei: z.boolean().default(false),
  comTelefone: z.boolean().default(true),
  comEmail: z.boolean().default(false),
  somenteCelular: z.boolean().default(false),
  somenteFixo: z.boolean().default(false),
  excluirEmailContab: z.boolean().default(true),
  dataAberturaInicio: z.string().default(""),
  dataAberturaFim: z.string().default(""),
  capitalMin: z.number().nullable().default(null),
  capitalMax: z.number().nullable().default(null),
  limite: z.number().int().min(1).max(2000).default(300),
  apenasNovos: z.boolean().default(true),
  cnaeTipo: z.enum(["principal", "secundario", "ambos"]).default("principal"),
  recuperacaoJudicial: z.boolean().default(false),
  mapsModo: z.enum(["nao_usar", "enriquecer", "filtrar", "filtrar_enriquecer"]).default("nao_usar"),
  minAvaliacoes: z.number().int().min(0).default(0),
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

  if (!filtros.cnaes.length && !filtros.recuperacaoJudicial) {
    return NextResponse.json({ error: "Selecione ao menos um CNAE para buscar." }, { status: 400 });
  }
  if (filtros.dataAberturaInicio && filtros.dataAberturaFim && filtros.dataAberturaInicio > filtros.dataAberturaFim) {
    return NextResponse.json(
      { error: "A data 'Abertura — de' está depois da 'Abertura — até'. Com elas assim nenhuma empresa pode atender ao filtro." },
      { status: 400 },
    );
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  const saldo = profile.cdd_credits;
  if (saldo <= 0) {
    return NextResponse.json({ error: "Você não tem créditos CNPJ disponíveis. Solicite mais ao administrador." }, { status: 402 });
  }

  let avisoSaldo: string | null = null;
  let limite = filtros.limite;
  if (saldo < limite) {
    avisoSaldo = `Você tem ${saldo} créditos — a busca considerou esse teto em vez dos ${limite} solicitados. Você só é cobrado pelos resultados que realmente vierem.`;
    limite = saldo;
  }

  const cddApiKey = profile.cdd_api_key || profile.cdd_api_key_admin || process.env.CDD_API_KEY || "";
  if (!cddApiKey) {
    return NextResponse.json({ error: "Nenhuma chave da Casa dos Dados configurada." }, { status: 400 });
  }

  let buscaTextual: BuscaTextual[] | null = null;
  let situacoesCadastrais: string[] | null = null;
  if (filtros.recuperacaoJudicial) {
    buscaTextual = [
      { texto: ["recuperacao judicial"], tipo_busca: "exata", razao_social: true, nome_fantasia: true },
    ];
    situacoesCadastrais = ["ATIVA", "SUSPENSA", "INAPTA"];
  }

  let excludeTels = new Set<string>();
  let excludeCnpjs = new Set<string>();
  if (filtros.apenasNovos) {
    const existentes = await buscarIdentificadoresExistentes(supabase, user.id);
    excludeTels = existentes.telefones;
    excludeCnpjs = existentes.cnpjs;
  }

  let resultados;
  try {
    resultados = await buscarCnpj({
      apiKey: cddApiKey,
      cnaes: filtros.cnaes,
      uf: filtros.uf,
      municipio: filtros.municipio,
      porte: filtros.porte.length ? filtros.porte : null,
      matrizFilial: filtros.matrizFilial,
      simplesOptante: filtros.simplesOptante,
      excluirSimples: filtros.excluirSimples,
      meiOptante: filtros.meiOptante,
      excluirMei: filtros.excluirMei,
      comTelefone: filtros.comTelefone,
      comEmail: filtros.comEmail,
      somenteCelular: filtros.somenteCelular,
      somenteFixo: filtros.somenteFixo,
      excluirEmailContab: filtros.excluirEmailContab,
      dataAberturaInicio: filtros.dataAberturaInicio,
      dataAberturaFim: filtros.dataAberturaFim,
      capitalMin: filtros.capitalMin,
      capitalMax: filtros.capitalMax,
      limite,
      excludePhones: filtros.apenasNovos ? excludeTels : undefined,
      excludeCnpjs: filtros.apenasNovos ? excludeCnpjs : undefined,
      cnaeTipo: filtros.cnaeTipo,
      buscaTextual,
      situacoesCadastrais,
      dedupRaiz: filtros.recuperacaoJudicial,
    });
  } catch (e) {
    if (e instanceof CasaDosDadosError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Ocorreu um erro inesperado na busca. Tente novamente." }, { status: 500 });
  }

  // Dedup ANTES de enriquecer — evita gastar créditos Maps num lead que já é duplicado.
  let dedupCnpjs = filtros.apenasNovos ? new Set(excludeCnpjs) : new Set<string>();
  let dedupTels = filtros.apenasNovos ? new Set(excludeTels) : new Set<string>();
  resultados = removerDuplicadosLote(resultados, dedupCnpjs, dedupTels);

  let avisoMaps: string | null = null;
  let mapsVerificados = 0;
  const usarMaps = filtros.mapsModo !== "nao_usar" && resultados.length > 0;

  if (usarMaps) {
    const resolucao = resolverChaveMaps(profile);
    if (resolucao.bloqueado) {
      avisoMaps =
        "Todas as chaves Google Maps atingiram o limite mensal. Você optou por pausar a busca nesse caso — mude isso em Configurações se quiser continuar além da cota. Os leads de CNPJ já buscados foram mantidos, só a etapa do Maps não rodou.";
    } else if (!resolucao.key) {
      avisoMaps = "Nenhuma chave Google Maps configurada — a etapa de enriquecimento/filtro não rodou.";
    } else {
      const filtrar = filtros.mapsModo === "filtrar" || filtros.mapsModo === "filtrar_enriquecer";
      const enriquecer = filtros.mapsModo === "enriquecer" || filtros.mapsModo === "filtrar_enriquecer";
      const nVerificados = resultados.length;
      const stats = { text_search_calls: 0, contact_data_calls: 0 };

      try {
        resultados = await enriquecerComMaps({
          resultados,
          apiKey: resolucao.key,
          showPhone: enriquecer,
          filtrar,
          minAvaliacoes: filtros.minAvaliacoes,
          stats,
        });
        mapsVerificados = nVerificados;

        if (filtrar) {
          avisoMaps = `Filtro do Google Maps: ${resultados.length} de ${nVerificados} empresas tinham perfil (mín. ${filtros.minAvaliacoes} avaliações).`;
        }
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          avisoMaps = "Cota Google Maps esgotada no meio do processo — parte das empresas pode não ter sido verificada. Os leads de CNPJ já buscados foram mantidos normalmente.";
          mapsVerificados = nVerificados;
        } else if (e instanceof MapsAccessError) {
          return NextResponse.json({ error: e.message }, { status: 400 });
        } else {
          throw e;
        }
      }

      await registrarUsoChaveMaps(supabase, user.id, profile, resolucao, stats.contact_data_calls, stats.text_search_calls);

      // Remove duplicados que só ficaram visíveis DEPOIS do enriquecimento
      // (o Maps pode preencher um telefone que bate com outro lead salvo).
      dedupCnpjs = filtros.apenasNovos ? new Set(excludeCnpjs) : new Set<string>();
      dedupTels = filtros.apenasNovos ? new Set(excludeTels) : new Set<string>();
      resultados = removerDuplicadosLote(resultados, dedupCnpjs, dedupTels);
    }
  }

  const localidade = filtros.municipio.length ? filtros.municipio.join(", ") : filtros.uf.join(", ");
  const nichoLabel = filtros.cnaes.length ? CODIGO_PARA_DESC[filtros.cnaes[0]] || filtros.cnaes[0] : "Recuperação Judicial";

  const searchId = await salvarPesquisa(supabase, user.id, {
    fonte: "cnpj",
    nicho: nichoLabel,
    subnicho: filtros.cnaes.join(", "),
    cidade: filtros.municipio.join(", "),
    estado: filtros.uf.join(", "),
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

  await debitarCreditos(supabase, user.id, "cdd_credits", resultados.length);
  if (mapsVerificados > 0 && profile.maps_credits_enabled) {
    await debitarCreditos(supabase, user.id, "maps_credits", mapsVerificados);
  }

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    avisos: [avisoSaldo, avisoMaps, avisoHistorico].filter(Boolean),
  });
}
