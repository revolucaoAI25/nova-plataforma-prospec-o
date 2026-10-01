import type { SupabaseClient } from "@supabase/supabase-js";
import { criarFunil, listarColunas, type ColunaNova } from "@/lib/funil-db";
import { statusConexoes, type ConexaoId } from "@/lib/conexoes";
import type { AutomationFlowRow, Json, Profile } from "@/lib/database.types";
import { CENARIOS, type CanalDisparo } from "./cenarios";
import { etapasDoFunil, ETAPAS_AUTOMATICAS, type LetraPlano, type PlanoOnboarding } from "./ia";

// Aplicar = transformar um plano em coisas reais na conta: funil, campanhas
// em rascunho já com as mensagens escritas pela IA e o fluxo PAUSADO.
// Ativar ("dar play") = depois que o passo a passo estiver completo,
// vincular número/remetente/conta às campanhas, ligar campanhas e fluxo.
// Tudo com o cliente admin: a rota já conferiu que o usuário é o dono do
// onboarding, e várias dessas tabelas só aceitam escrita do servidor.

export interface AplicacaoRow {
  id: string;
  user_id: string;
  letra: LetraPlano;
  cenario_id: string;
  titulo: string;
  flow_id: string | null;
  funil_id: string | null;
  campanhas: Partial<Record<CanalDisparo, string>>;
  status: "aguardando_conexoes" | "ativo" | "pausado";
  criado_em: string;
  ativado_em: string | null;
  /** Cópia da sugestão no momento em que foi usada (nulo em aplicações antigas). */
  plano: PlanoOnboarding | null;
  /** resultado.geradoEm da geração de onde a sugestão veio. */
  geracao: string | null;
}

/** Etapas do funil com papel: automáticas → negócio (penúltima = ganho, última = perda). */
function colunasDoFunil(plano: PlanoOnboarding): ColunaNova[] {
  const etapas = etapasDoFunil(plano);
  const papeisAuto = ["entrada", "cadencia", "respondeu"] as const;
  return etapas.map((nome, i) => {
    if (i < ETAPAS_AUTOMATICAS.length) return { nome, papel: papeisAuto[i] };
    const doFim = etapas.length - 1 - i;
    return { nome, papel: doFim === 0 ? "perdido" : doFim === 1 ? "ganho" : null };
  });
}

const TABELA_CAMPANHA: Record<CanalDisparo, string> = {
  whatsapp: "dispatch_campaigns",
  email: "email_campaigns",
  linkedin: "linkedin_campaigns",
};

const LIMITE_NOVOS_PADRAO: Record<CanalDisparo, number> = { whatsapp: 30, email: 40, linkedin: 15 };

async function criarCampanhas(
  sb: SupabaseClient,
  userId: string,
  plano: PlanoOnboarding,
  nomeBase: string,
): Promise<Partial<Record<CanalDisparo, string>>> {
  const campanhas: Partial<Record<CanalDisparo, string>> = {};
  const cenario = CENARIOS[plano.cenarioId];
  const m = plano.mensagens;

  const ab = m.testeAB ?? null;
  for (const canal of cenario.canais) {
    const { data } = await sb
      .from(TABELA_CAMPANHA[canal])
      .insert({
        user_id: userId, nome: `${nomeBase} (${canal})`, status: "rascunho", tipo_origem: "manual",
        // Ritmo inicial conservador (dá pra mudar na campanha): leads novos
        // por dia, em dias úteis das 8h às 19h (padrão da coluna).
        limite_novos_por_dia: LIMITE_NOVOS_PADRAO[canal],
      })
      .select("id")
      .single();
    const campaignId = data?.id as string | undefined;
    if (!campaignId) throw new Error(`Não foi possível criar a campanha de ${canal}.`);
    campanhas[canal] = campaignId;

    if (canal === "whatsapp" && m.whatsapp.length) {
      await sb.from("dispatch_cadence_steps").insert(
        m.whatsapp.map((e, i) => ({
          campaign_id: campaignId, ordem: i + 1, atraso_horas: Math.max(0, e.atrasoHoras), corpo_mensagem: e.texto,
          corpo_mensagem_b: i === 0 ? ab?.whatsappAbertura || null : null,
        })),
      );
    }
    if (canal === "email" && m.email.length) {
      await sb.from("email_cadence_steps").insert(
        m.email.map((e, i) => ({
          campaign_id: campaignId, ordem: i + 1,
          // Multicanal: o 1º e-mail sai pelo menos 1 dia depois do 1º WhatsApp.
          atraso_horas: i === 0 && cenario.canais.includes("whatsapp") ? Math.max(24, e.atrasoHoras) : Math.max(0, e.atrasoHoras),
          assunto: e.assunto, corpo: e.corpo,
          assunto_b: i === 0 ? ab?.emailAssunto || null : null,
        })),
      );
    }
    if (canal === "linkedin") {
      const etapas = [
        {
          campaign_id: campaignId, ordem: 1, atraso_horas: 0, tipo: "convite", nota: m.linkedinNota?.slice(0, 300) || null, corpo: null,
          nota_b: m.linkedinNota ? ab?.linkedinNota?.slice(0, 300) || null : null,
        },
        ...m.linkedinMensagens.map((e, i) => ({
          campaign_id: campaignId, ordem: i + 2, atraso_horas: Math.max(0, e.atrasoHoras), tipo: "mensagem", nota: null, corpo: e.texto,
        })),
      ];
      await sb.from("linkedin_cadence_steps").insert(etapas);
    }
  }
  return campanhas;
}

async function desfazer(sb: SupabaseClient, criado: { flowId?: string; funilId?: string; campanhas: Partial<Record<CanalDisparo, string>> }) {
  if (criado.flowId) await sb.from("automation_flows").delete().eq("id", criado.flowId);
  for (const [canal, id] of Object.entries(criado.campanhas) as [CanalDisparo, string][]) {
    await sb.from(TABELA_CAMPANHA[canal]).delete().eq("id", id);
  }
  if (criado.funilId) await sb.from("funis").delete().eq("id", criado.funilId);
}

/**
 * "atual" = começa com o volume que os créditos de hoje pagam (sem passar do
 * sugerido); "sugerido" = o volume da sugestão. Dá pra subir depois no nó de
 * extração ou no ritmo da campanha.
 */
export type VolumeInicial = "sugerido" | "atual";

function comVolume(plano: PlanoOnboarding, volume: VolumeInicial): PlanoOnboarding {
  const hoje = plano.estimativa.leadsPorExecucaoHoje;
  if (volume !== "atual" || !hoje || hoje >= plano.parametros.leadsPorExecucao) return plano;
  return {
    ...plano,
    parametros: { ...plano.parametros, leadsPorExecucao: hoje },
    ajustesAutomaticos: [
      ...plano.ajustesAutomaticos,
      `Começou com ${hoje} leads por execução (o que seus créditos de hoje comportam) em vez de ${plano.parametros.leadsPorExecucao}. Dá pra aumentar na automação quando tiver mais créditos.`,
    ],
  };
}

export async function aplicarPlano(
  sb: SupabaseClient, userId: string, planoOriginal: PlanoOnboarding, geracao: string, volume: VolumeInicial = "sugerido",
): Promise<AplicacaoRow> {
  const plano = comVolume(planoOriginal, volume);
  const { data: existente } = await sb
    .from("onboarding_aplicacoes").select("*")
    .eq("user_id", userId).eq("letra", plano.letra).eq("geracao", geracao)
    .maybeSingle();
  if (existente) return existente as AplicacaoRow;

  const cenario = CENARIOS[plano.cenarioId];
  const nomeBase = `Sugestão ${plano.letra} — ${plano.titulo}`.slice(0, 120);
  const criado: { flowId?: string; funilId?: string; campanhas: Partial<Record<CanalDisparo, string>> } = { campanhas: {} };

  try {
    const funilId = await criarFunil(sb, userId, nomeBase, colunasDoFunil(plano));
    if (!funilId) throw new Error("Não foi possível criar o funil da sugestão.");
    criado.funilId = funilId;
    const [primeiraColuna] = await listarColunas(sb, funilId);
    if (!primeiraColuna) throw new Error("O funil da sugestão ficou sem colunas.");

    criado.campanhas = await criarCampanhas(sb, userId, plano, nomeBase);

    const grafo = cenario.montar(plano.parametros, { funilId, colunaId: primeiraColuna.id, campanhas: criado.campanhas });
    const { data: flow } = await sb
      .from("automation_flows")
      .insert({ user_id: userId, nome: nomeBase, ativo: false, nodes: grafo.nodes as unknown as Json, edges: grafo.edges as unknown as Json })
      .select("id")
      .single();
    if (!flow?.id) throw new Error("Não foi possível criar o fluxo da sugestão.");
    criado.flowId = flow.id;

    const { data: aplicacao, error } = await sb
      .from("onboarding_aplicacoes")
      .insert({
        user_id: userId, letra: plano.letra, cenario_id: plano.cenarioId, titulo: plano.titulo,
        flow_id: flow.id, funil_id: funilId, campanhas: criado.campanhas, plano, geracao,
      })
      .select("*")
      .single();
    if (error || !aplicacao) throw new Error("Não foi possível registrar a sugestão aplicada.");
    return aplicacao as AplicacaoRow;
  } catch (e) {
    await desfazer(sb, criado);
    throw e;
  }
}

// ── Passo a passo ─────────────────────────────────────────────────

export interface PassoChecklist {
  id: string;
  titulo: string;
  descricao: string;
  feito: boolean;
  /** Passo que impede o play enquanto não estiver feito. */
  obrigatorio: boolean;
  href: string;
  acao: string;
}

const PASSO_CONEXAO: Record<ConexaoId, { titulo: string; descricao: string; acao: string }> = {
  whatsapp: {
    titulo: "Conecte o número de WhatsApp",
    descricao: "Leia o QR code com o número dedicado à prospecção — nunca o seu número principal.",
    acao: "Conectar WhatsApp",
  },
  email: {
    titulo: "Configure o e-mail de envio",
    descricao: "Verifique seu domínio (3 registros no DNS) e crie um remetente, ex.: comercial@suaempresa.com.br.",
    acao: "Configurar e-mail",
  },
  linkedin: {
    titulo: "Conecte sua conta do LinkedIn",
    descricao: "Faça login pela janela segura — os convites saem da sua conta, num ritmo seguro.",
    acao: "Conectar LinkedIn",
  },
  sheets: {
    titulo: "Conecte o Google Sheets",
    descricao: "É de lá que a automação lê a sua base de contatos.",
    acao: "Conectar Google",
  },
  openai: {
    titulo: "Cadastre sua chave da OpenAI",
    descricao: "A pesquisa por IA de cada lead roda na sua conta OpenAI — o custo é cobrado direto por ela.",
    acao: "Cadastrar chave",
  },
};

export async function checklistDoPlano(
  sb: SupabaseClient,
  profile: Profile,
  plano: PlanoOnboarding,
  aplicacao: AplicacaoRow | null,
): Promise<PassoChecklist[]> {
  const cenario = CENARIOS[plano.cenarioId];
  const conexoes = await statusConexoes(sb, profile);
  const conexao = (id: ConexaoId) => conexoes.find((c) => c.id === id)!;
  const passos: PassoChecklist[] = [];

  const necessarias: ConexaoId[] = [...cenario.canais];
  if (cenario.fonte === "base_propria") necessarias.unshift("sheets");
  if (cenario.usaOpenai) necessarias.push("openai");

  for (const id of necessarias) {
    const c = conexao(id);
    passos.push({ id: `conexao_${id}`, ...PASSO_CONEXAO[id], feito: c.conectado, obrigatorio: true, href: c.href });
  }

  if (cenario.fonte === "base_propria") {
    let planilhaEscolhida = false;
    if (aplicacao?.flow_id) {
      const { data: flow } = await sb.from("automation_flows").select("nodes").eq("id", aplicacao.flow_id).maybeSingle();
      const gatilho = ((flow as Pick<AutomationFlowRow, "nodes"> | null)?.nodes ?? []).find((n) => n.tipo === "gatilho_planilha");
      const cfg = (gatilho?.config ?? {}) as Record<string, unknown>;
      planilhaEscolhida = Boolean(cfg.sheetId && cfg.abaNome);
    }
    passos.push({
      id: "planilha_base",
      titulo: "Escolha a planilha da sua base",
      descricao: "Abra o gatilho do fluxo e selecione a planilha e a aba. A planilha precisa ter colunas \"telefone\" e \"nome\"" +
        (cenario.id === "base_enriquecida" ? " e \"cnpj\"." : "."),
      feito: planilhaEscolhida,
      obrigatorio: true,
      href: aplicacao?.flow_id ? `/automacoes/fluxos/${aplicacao.flow_id}` : "/automacoes",
      acao: "Escolher planilha",
    });
  }

  if (aplicacao) {
    const campanhas = Object.entries(aplicacao.campanhas) as [CanalDisparo, string][];
    const destinos: Record<CanalDisparo, string> = { whatsapp: "/disparo/campanhas/", email: "/disparo-email/campanhas/", linkedin: "/disparo-linkedin/campanhas/" };
    for (const [canal, id] of campanhas) {
      passos.push({
        id: `mensagens_${canal}`,
        titulo: `Revise as mensagens de ${canal === "whatsapp" ? "WhatsApp" : canal === "email" ? "e-mail" : "LinkedIn"}`,
        descricao: "A IA já escreveu a sequência — dê uma lida e ajuste o que quiser antes de começar.",
        feito: aplicacao.status === "ativo",
        obrigatorio: false,
        href: `${destinos[canal]}${id}`,
        acao: "Revisar mensagens",
      });
    }
  }

  const custoPrimeiraExecucao = plano.estimativa.custoPorLead * plano.parametros.leadsPorExecucao;
  if (custoPrimeiraExecucao > 0) {
    passos.push({
      id: "creditos",
      titulo: "Tenha créditos pra primeira rodada",
      descricao: `A primeira execução usa até ${custoPrimeiraExecucao.toLocaleString("pt-BR")} créditos. Seu saldo: ${profile.creditos.toLocaleString("pt-BR")}.`,
      feito: profile.creditos >= custoPrimeiraExecucao,
      obrigatorio: false,
      href: "/creditos",
      acao: "Ver créditos",
    });
  }

  return passos;
}

// ── Play / pausa ──────────────────────────────────────────────────

async function primeiroRecursoConectado(sb: SupabaseClient, userId: string, canal: CanalDisparo): Promise<string | null> {
  if (canal === "whatsapp") {
    // Campanha com texto livre só roda no canal não-oficial — o oficial
    // exige template aprovado pela Meta.
    const { data } = await sb.from("whatsapp_instances").select("id").eq("user_id", userId).eq("status", "conectado").eq("canal", "evolution").limit(1);
    return data?.[0]?.id ?? null;
  }
  if (canal === "email") {
    const { data } = await sb.from("email_senders").select("id").eq("user_id", userId).eq("ativo", true).limit(1);
    return data?.[0]?.id ?? null;
  }
  const { data } = await sb.from("linkedin_accounts").select("id").eq("user_id", userId).eq("status", "conectado").limit(1);
  return data?.[0]?.id ?? null;
}

const COLUNA_VINCULO: Record<CanalDisparo, string> = { whatsapp: "instance_id", email: "sender_id", linkedin: "account_id" };

export async function ativarPlano(sb: SupabaseClient, profile: Profile, plano: PlanoOnboarding, aplicacao: AplicacaoRow): Promise<void> {
  const pendentes = (await checklistDoPlano(sb, profile, plano, aplicacao)).filter((p) => p.obrigatorio && !p.feito);
  if (pendentes.length) throw new Error(`Falta concluir: ${pendentes.map((p) => p.titulo.toLowerCase()).join("; ")}.`);
  if (!aplicacao.flow_id) throw new Error("O fluxo desta sugestão foi removido. Use a sugestão de novo.");

  for (const [canal, campaignId] of Object.entries(aplicacao.campanhas) as [CanalDisparo, string][]) {
    const { data } = await sb.from(TABELA_CAMPANHA[canal]).select("*").eq("id", campaignId).maybeSingle();
    const campanha = data as Record<string, unknown> | null;
    if (!campanha) throw new Error(`A campanha de ${canal} desta sugestão foi removida.`);
    const campos: Record<string, unknown> = { status: "ativa" };
    if (!campanha[COLUNA_VINCULO[canal]]) {
      const recurso = await primeiroRecursoConectado(sb, profile.id, canal);
      if (!recurso) throw new Error(`Nenhum ${canal === "whatsapp" ? "número de WhatsApp (não oficial)" : canal === "email" ? "remetente de e-mail" : "conta do LinkedIn"} conectado.`);
      campos[COLUNA_VINCULO[canal]] = recurso;
    }
    await sb.from(TABELA_CAMPANHA[canal]).update(campos).eq("id", campaignId);
  }

  await sb.from("automation_flows").update({ ativo: true }).eq("id", aplicacao.flow_id);
  await sb.from("onboarding_aplicacoes").update({ status: "ativo", ativado_em: new Date().toISOString() }).eq("id", aplicacao.id);
}

export async function pausarPlano(sb: SupabaseClient, aplicacao: AplicacaoRow): Promise<void> {
  if (aplicacao.flow_id) await sb.from("automation_flows").update({ ativo: false }).eq("id", aplicacao.flow_id);
  for (const [canal, campaignId] of Object.entries(aplicacao.campanhas) as [CanalDisparo, string][]) {
    await sb.from(TABELA_CAMPANHA[canal]).update({ status: "pausada" }).eq("id", campaignId);
  }
  await sb.from("onboarding_aplicacoes").update({ status: "pausado" }).eq("id", aplicacao.id);
}
