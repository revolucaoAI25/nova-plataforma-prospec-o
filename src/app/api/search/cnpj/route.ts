import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos, custoAcao } from "@/lib/credits";
import { chaveCasaDosDados, chaveGoogleMaps } from "@/lib/platform-keys";
import {
  buscarCnpj,
  removerDuplicadosLote,
  CasaDosDadosError,
  type BuscaTextual,
} from "@/lib/integrations/casa-dos-dados";
import { enriquecerComMaps, QuotaExceededError, MapsAccessError } from "@/lib/integrations/google-maps";
import { salvarPesquisa, salvarLeads, buscarIdentificadoresExistentes } from "@/lib/db";
import { autoExportarSheetsSeConfigurado } from "@/lib/auto-export";
import { CODIGO_PARA_DESC } from "@/lib/data/cnaes";
import { criarRunBigDataCorp, perfilComBigDataCorpEnrichmentHabilitado } from "@/lib/bigdatacorp-enrichment-db";
import { bigDataCorpConfigurado } from "@/lib/integrations/bigdatacorp";
import { emTesteGratis, MSG_TESTE_GRATIS_SEM_CREDITOS } from "@/lib/teste-gratis";

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
  enriquecerBigDataCorp: z.boolean().default(false),
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

  // A verificação no Maps custa por lead verificado e o débito satura em 0 —
  // sem somar ela aqui, um saldo pequeno liberava centenas de chamadas pagas
  // ao Google sem cobrir o custo.
  const custoCnpj =
    (await custoAcao(supabase, "cnpj")) +
    (filtros.mapsModo !== "nao_usar" ? await custoAcao(supabase, "cnpj_maps_extra") : 0);
  const saldo = profile.creditos;
  if (saldo < custoCnpj) {
    const erro = emTesteGratis(profile) ? MSG_TESTE_GRATIS_SEM_CREDITOS : "Você não tem créditos suficientes. Adquira mais créditos pra continuar.";
    return NextResponse.json({ error: erro }, { status: 402 });
  }

  let avisoSaldo: string | null = null;
  let limite = filtros.limite;
  const limiteViaSaldo = Math.floor(saldo / custoCnpj);
  if (limiteViaSaldo < limite) {
    avisoSaldo = `Seu saldo dá pra ${limiteViaSaldo} resultado(s) desta busca — a busca considerou esse teto em vez dos ${limite} solicitados. Você só é cobrado pelos resultados que realmente vierem.`;
    limite = limiteViaSaldo;
  }

  const cddApiKey = await chaveCasaDosDados();
  if (!cddApiKey) {
    return NextResponse.json({ error: "Busca por CNPJ não configurada nesta plataforma." }, { status: 400 });
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
    const mapsApiKey = await chaveGoogleMaps();
    if (!mapsApiKey) {
      avisoMaps = "A verificação no Google Maps está temporariamente indisponível — os leads de CNPJ foram mantidos, só essa etapa não rodou.";
    } else {
      const filtrar = filtros.mapsModo === "filtrar" || filtros.mapsModo === "filtrar_enriquecer";
      const enriquecer = filtros.mapsModo === "enriquecer" || filtros.mapsModo === "filtrar_enriquecer";
      const nVerificados = resultados.length;
      const stats = { text_search_calls: 0, contact_data_calls: 0 };

      try {
        resultados = await enriquecerComMaps({
          resultados,
          apiKey: mapsApiKey,
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

  await debitarCreditos(supabase, user.id, "cnpj", resultados.length);
  if (mapsVerificados > 0) {
    await debitarCreditos(supabase, user.id, "cnpj_maps_extra", mapsVerificados);
  }

  const avisoSheets = await autoExportarSheetsSeConfigurado(supabase, user.id, searchId);

  let bigdatacorpRunId: string | null = null;
  let avisoBigDataCorp: string | null = null;
  if (filtros.enriquecerBigDataCorp && resultados.length) {
    if (!(await bigDataCorpConfigurado())) {
      avisoBigDataCorp = "Enriquecimento por CNPJ (sócios/contato) não configurado nesta plataforma — etapa não rodou.";
    } else if (!(await perfilComBigDataCorpEnrichmentHabilitado(supabase, user.id))) {
      avisoBigDataCorp = "Enriquecimento por CNPJ (sócios/contato) não habilitado para sua conta — etapa não rodou.";
    } else {
      const itens = resultados.filter((r) => r.cnpj).map((r) => ({ cnpj: r.cnpj, nomeLead: r.nome }));
      const run = await criarRunBigDataCorp(supabase, user.id, itens, "busca_cnpj");
      if (run) {
        bigdatacorpRunId = run.id;
        avisoBigDataCorp = `Enriquecimento por CNPJ (sócios/contato) iniciado em background pra ${run.total} empresa(s) — acompanhe em Enriquecimento → Sócios e Contato.`;
      }
    }
  }

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    bigdatacorpRunId,
    avisos: [avisoSaldo, avisoMaps, avisoHistorico, avisoSheets, avisoBigDataCorp].filter(Boolean),
  });
}
