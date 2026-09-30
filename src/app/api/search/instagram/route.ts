import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos, custoAcao } from "@/lib/credits";
import { chaveApify } from "@/lib/platform-keys";
import { buscarInstagram } from "@/lib/integrations/instagram";
import { salvarPesquisa, salvarLeads, buscarInstagramIdsExistentes } from "@/lib/db";
import { autoExportarSheetsSeConfigurado } from "@/lib/auto-export";

const bodySchema = z.object({
  tipo: z.enum(["seguidores", "seguindo"]),
  alvo: z.string().min(1),
  limite: z.number().int().min(100).max(1000).default(200),
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
  if (!profile.instagram_visible) {
    return NextResponse.json({ error: "A busca por Instagram não está habilitada para sua conta." }, { status: 403 });
  }

  const limite = filtros.limite;
  const custo = await custoAcao(supabase, "instagram");
  const saldo = profile.creditos;
  if (saldo < limite * custo) {
    return NextResponse.json(
      { error: `Créditos insuficientes. Você tem ${saldo} créditos e essa busca pode custar até ${limite * custo}. Reduza o limite ou adquira mais créditos.` },
      { status: 402 },
    );
  }

  const apifyApiKey = await chaveApify();
  if (!apifyApiKey) {
    return NextResponse.json({ error: "Essa busca está temporariamente indisponível. Tente novamente mais tarde." }, { status: 503 });
  }

  let excludeIds = new Set<string>();
  if (filtros.apenasNovos) {
    excludeIds = await buscarInstagramIdsExistentes(supabase, user.id);
  }

  let resultados;
  try {
    resultados = await buscarInstagram({
      apifyApiKey,
      tipo: filtros.tipo,
      alvo: filtros.alvo,
      limite,
      excludeIds: filtros.apenasNovos ? excludeIds : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const searchId = await salvarPesquisa(supabase, user.id, {
    fonte: "instagram",
    nicho: "Instagram",
    subnicho: filtros.tipo === "seguindo" ? "Following" : "Seguidor",
    cidade: "",
    estado: "",
    localidade: filtros.alvo,
    totalResults: resultados.length,
    filtros,
  });

  let avisoHistorico: string | null = null;
  if (!searchId) {
    avisoHistorico = "Os resultados foram encontrados, mas não foi possível salvá-los no Histórico. Exporte agora antes de sair desta tela.";
  } else if (!(await salvarLeads(supabase, user.id, searchId, resultados))) {
    avisoHistorico = "Os resultados foram encontrados, mas não foi possível salvá-los no Histórico. Exporte agora antes de sair desta tela.";
  }

  await debitarCreditos(supabase, user.id, "instagram", resultados.length);

  const avisoSheets = await autoExportarSheetsSeConfigurado(supabase, user.id, searchId);

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    avisos: [avisoHistorico, avisoSheets].filter(Boolean),
  });
}
