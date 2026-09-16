import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos } from "@/lib/credits";
import { resolverChaveApify } from "@/lib/apify-key";
import { buscarInstagram } from "@/lib/integrations/instagram";
import { salvarPesquisa, salvarLeads, buscarInstagramIdsExistentes } from "@/lib/db";
import { autoExportarSheetsSeConfigurado } from "@/lib/auto-export";

const bodySchema = z.object({
  tipo: z.enum(["seguidores", "seguindo"]),
  alvo: z.string().min(1),
  limite: z.number().int().min(1).max(2000).default(200),
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

  let avisoSaldo: string | null = null;
  let limite = filtros.limite;
  if (profile.instagram_credits_enabled) {
    const saldo = profile.instagram_credits;
    if (saldo <= 0) {
      return NextResponse.json({ error: "Você não tem créditos Instagram disponíveis. Solicite mais ao administrador." }, { status: 402 });
    }
    if (saldo < limite) {
      avisoSaldo = `Você tem ${saldo} créditos Instagram — a busca considerou esse teto em vez dos ${limite} solicitados.`;
      limite = saldo;
    }
  }

  const resolucao = resolverChaveApify(profile);
  if (!resolucao.key) {
    return NextResponse.json({ error: "Nenhuma chave Apify configurada. Acesse Configurações → Instagram." }, { status: 400 });
  }

  let excludeIds = new Set<string>();
  if (filtros.apenasNovos) {
    excludeIds = await buscarInstagramIdsExistentes(supabase, user.id);
  }

  let resultados;
  try {
    resultados = await buscarInstagram({
      apifyApiKey: resolucao.key,
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

  if (profile.instagram_credits_enabled) {
    await debitarCreditos(supabase, user.id, "instagram_credits", resultados.length);
  }

  const avisoSheets = await autoExportarSheetsSeConfigurado(supabase, user.id, searchId);

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    avisos: [avisoSaldo, avisoHistorico, avisoSheets].filter(Boolean),
  });
}
