import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos, custoAcao } from "@/lib/credits";
import { chaveApify } from "@/lib/platform-keys";
import { buscarLinkedIn } from "@/lib/integrations/linkedin";
import { salvarPesquisa, salvarLeads, buscarLinkedInUrlsExistentes } from "@/lib/db";
import { autoExportarSheetsSeConfigurado } from "@/lib/auto-export";

const bodySchema = z.object({
  cargos: z.array(z.string().min(1)).default([]),
  localizacoes: z.array(z.string().min(1)).default([]),
  industrias: z.array(z.string().min(1)).default([]),
  palavraChave: z.string().default(""),
  buscarEmail: z.boolean().default(false),
  limite: z.number().int().min(1).max(500).default(100),
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

  const profile = await getProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  if (!profile.linkedin_visible) {
    return NextResponse.json({ error: "A busca por LinkedIn não está habilitada para sua conta." }, { status: 403 });
  }

  const limite = filtros.limite;
  const custo = await custoAcao(supabase, "linkedin");
  const saldo = profile.creditos;
  if (saldo < limite * custo) {
    return NextResponse.json(
      { error: `Créditos insuficientes. Você tem ${saldo} créditos e essa busca pode custar até ${limite * custo} (busca LinkedIn é a mais cara por resultado). Reduza o limite ou adquira mais créditos.` },
      { status: 402 },
    );
  }

  const apifyApiKey = await chaveApify();
  if (!apifyApiKey) {
    return NextResponse.json({ error: "Essa busca está temporariamente indisponível. Tente novamente mais tarde." }, { status: 503 });
  }

  let excludeUrls = new Set<string>();
  if (filtros.apenasNovos) {
    excludeUrls = await buscarLinkedInUrlsExistentes(supabase, user.id);
  }

  let resultados;
  try {
    resultados = await buscarLinkedIn({
      apifyApiKey,
      cargos: filtros.cargos,
      localizacoes: filtros.localizacoes,
      industrias: filtros.industrias,
      palavraChave: filtros.palavraChave,
      buscarEmail: filtros.buscarEmail,
      limite,
      excludeUrls: filtros.apenasNovos ? excludeUrls : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const searchId = await salvarPesquisa(supabase, user.id, {
    fonte: "linkedin",
    nicho: "LinkedIn",
    subnicho: filtros.cargos.join(", "),
    cidade: "",
    estado: "",
    localidade: filtros.localizacoes.join(", ") || filtros.palavraChave,
    totalResults: resultados.length,
    filtros,
  });

  let avisoHistorico: string | null = null;
  if (!searchId) {
    avisoHistorico = "Os resultados foram encontrados, mas não foi possível salvá-los no Histórico. Exporte agora antes de sair desta tela.";
  } else if (!(await salvarLeads(supabase, user.id, searchId, resultados))) {
    avisoHistorico = "Os resultados foram encontrados, mas não foi possível salvá-los no Histórico. Exporte agora antes de sair desta tela.";
  }

  await debitarCreditos(supabase, user.id, "linkedin", resultados.length);

  const avisoSheets = await autoExportarSheetsSeConfigurado(supabase, user.id, searchId);

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    avisos: [avisoHistorico, avisoSheets].filter(Boolean),
  });
}
