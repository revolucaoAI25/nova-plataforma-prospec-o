import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, debitarCreditos } from "@/lib/credits";
import { resolverChaveApify, registrarUsoChaveApify } from "@/lib/apify-key";
import { buscarLinkedIn } from "@/lib/integrations/linkedin";
import { salvarPesquisa, salvarLeads, buscarLinkedInUrlsExistentes } from "@/lib/db";
import { autoExportarSheetsSeConfigurado } from "@/lib/auto-export";

const bodySchema = z.object({
  cargos: z.array(z.string().min(1)).default([]),
  localizacoes: z.array(z.string().min(1)).default([]),
  palavraChave: z.string().default(""),
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
  if (profile.linkedin_credits_enabled) {
    const saldo = profile.linkedin_credits;
    if (saldo < limite) {
      return NextResponse.json(
        { error: `Créditos insuficientes. Você tem ${saldo} créditos LinkedIn e a busca requer ${limite}. Reduza o limite ou solicite mais créditos ao administrador.` },
        { status: 402 },
      );
    }
  }

  const resolucao = resolverChaveApify(profile);
  if (!resolucao.key) {
    return NextResponse.json({ error: "Nenhuma chave Apify configurada. Acesse Configurações → Instagram (a mesma chave vale para LinkedIn)." }, { status: 400 });
  }

  let excludeUrls = new Set<string>();
  if (filtros.apenasNovos) {
    excludeUrls = await buscarLinkedInUrlsExistentes(supabase, user.id);
  }

  let resultados;
  try {
    resultados = await buscarLinkedIn({
      apifyApiKey: resolucao.key,
      cargos: filtros.cargos,
      localizacoes: filtros.localizacoes,
      palavraChave: filtros.palavraChave,
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

  if (profile.linkedin_credits_enabled) {
    await debitarCreditos(supabase, user.id, "linkedin_credits", resultados.length);
  }
  if (resolucao.source === "pool") {
    await registrarUsoChaveApify(supabase, user.id, profile, resolucao, resultados.length);
  }

  const avisoSheets = await autoExportarSheetsSeConfigurado(supabase, user.id, searchId);

  return NextResponse.json({
    searchId,
    total: resultados.length,
    leads: resultados,
    avisos: [avisoHistorico, avisoSheets].filter(Boolean),
  });
}
