import type { SupabaseClient } from "@supabase/supabase-js";
import { renderizarMensagem } from "../src/lib/mensagem";
import {
  requeueTravadosLinkedin, listarContasConectadas, claimLinkedInTarget, obterCampanhaLinkedin,
  listarEtapasLinkedin, proximaEtapaLinkedin, marcarAguardandoAceite, marcarEnviadoLinkedin, marcarFalhaLinkedin,
  liberarProximaAcaoConta, atualizarTargetLinkedin, estaOptOutLinkedin,
  listarCampanhasLinkedinSheetWatchAtivas, listarCampanhasLinkedinAutoTriggerAtivas, obterSheetWatcherLinkedin,
  atualizarSheetWatcherLinkedin, enrollLinkedInTargets, buscarLeadsFiltro, atualizarCampanhaLinkedin,
  contarConvitesHojeConta, contarMensagensHojeConta, listarTargetsAguardandoAceitePorConta, liberarAlvoAposAceite,
  perfilComLinkedinDisparoHabilitado,
} from "../src/lib/linkedin-dispatch-db";
import { resolverPerfil, enviarConvite, criarChat, enviarMensagemChat, listarConvitesEnviados } from "../src/lib/integrations/unipile";
import { extrairIdentificadorPublico } from "../src/lib/linkedin-url";
import { lerValores } from "../src/lib/integrations/google-sheets";
import { getProfile } from "../src/lib/credits";
import type { LinkedinAccountRow, LinkedinCampaignRow, LinkedinTargetRow, LinkedinCadenceStepRow, LinkedinStepTipo, GoogleSheetsCreds } from "../src/lib/database.types";

function contaLiberada(conta: LinkedinAccountRow, tipoAcao: LinkedinStepTipo): boolean {
  const campo = tipoAcao === "convite" ? conta.proximo_convite_liberado_em : conta.proximo_mensagem_liberado_em;
  if (!campo) return true;
  return new Date() >= new Date(campo);
}

function etapaAtualOrdem(target: LinkedinTargetRow, etapas: LinkedinCadenceStepRow[]): number {
  if (!target.current_step_id) return 0;
  return etapas.find((e) => e.id === target.current_step_id)?.ordem ?? 0;
}

async function processarConta(sb: SupabaseClient, conta: LinkedinAccountRow, log: (msg: string) => void) {
  if (conta.status !== "conectado" || !conta.unipile_account_id) return;

  const convitesLiberados = contaLiberada(conta, "convite") && (await contarConvitesHojeConta(sb, conta.id)) < conta.limite_diario_convites;
  const mensagensLiberadas = contaLiberada(conta, "mensagem") && (await contarMensagensHojeConta(sb, conta.id)) < conta.limite_diario_mensagens;
  if (!convitesLiberados && !mensagensLiberadas) return;

  const target = await claimLinkedInTarget(sb, conta.id);
  if (!target) return;

  const etapas = await listarEtapasLinkedin(sb, target.campaign_id);
  const ordemAtual = etapaAtualOrdem(target, etapas);
  const step = proximaEtapaLinkedin(etapas, ordemAtual);

  const campanha = await obterCampanhaLinkedin(sb, target.campaign_id);
  if (!campanha || campanha.status !== "ativa") {
    await marcarFalhaLinkedin(sb, target, target.campaign_id, null, step?.tipo || "convite", "Campanha não está mais ativa nesse momento.");
    return;
  }

  // Alvo pode ter sido inscrito antes de um admin revogar o flag do
  // usuário — reconfirma a cada tick, não só na inscrição.
  if (!(await perfilComLinkedinDisparoHabilitado(sb, campanha.user_id))) {
    await marcarFalhaLinkedin(sb, target, target.campaign_id, null, step?.tipo || "convite", "Disparo por LinkedIn não está mais habilitado para esta conta.");
    return;
  }

  if (await estaOptOutLinkedin(sb, target.linkedin_url, campanha.user_id)) {
    await atualizarTargetLinkedin(sb, target.id, { status: "removido", atualizado_em: new Date().toISOString() });
    return;
  }

  if (!step) {
    await atualizarTargetLinkedin(sb, target.id, { status: "concluido", atualizado_em: new Date().toISOString() });
    return;
  }

  // A conta pode estar liberada pra convite mas não pra mensagem (ou
  // vice-versa) — o claim não sabe o tipo da etapa de antemão. Se o tipo
  // da etapa reivindicada estiver bloqueado, devolve o alvo pra fila em
  // vez de tentar enviar (não é um crash, não precisa esperar o
  // requeueTravados) e tenta de novo num tick futuro.
  if ((step.tipo === "convite" && !convitesLiberados) || (step.tipo === "mensagem" && !mensagensLiberadas)) {
    await atualizarTargetLinkedin(sb, target.id, { status: "pendente" });
    return;
  }

  try {
    let providerId = target.provider_id;
    if (!providerId) {
      const identificador = extrairIdentificadorPublico(target.linkedin_url);
      if (!identificador) throw new Error("Não foi possível extrair o identificador do perfil a partir da URL.");
      const perfil = await resolverPerfil(conta.unipile_account_id, identificador);
      providerId = perfil.provider_id;
      await atualizarTargetLinkedin(sb, target.id, { provider_id: providerId });
    }

    const lead = (target.lead_snapshot as Record<string, unknown>) || {};
    if (step.tipo === "convite") {
      // Nota de convite do LinkedIn aceita no máximo 300 caracteres.
      const nota = renderizarMensagem(step.nota || "", lead).slice(0, 300);
      const resp = await enviarConvite(conta.unipile_account_id, providerId, nota || undefined);
      await marcarAguardandoAceite(sb, target, target.campaign_id, step, resp.id || "");
      await liberarProximaAcaoConta(sb, conta.id, "convite", campanha.intervalo_min_seg, campanha.intervalo_max_seg);
    } else {
      const corpo = renderizarMensagem(step.corpo || "", lead);
      let chatId = target.chat_id;
      let providerRef = "";
      if (!chatId) {
        const chat = await criarChat(conta.unipile_account_id, providerId, corpo);
        chatId = chat.chat_id;
        await atualizarTargetLinkedin(sb, target.id, { chat_id: chatId });
      } else {
        const resp = await enviarMensagemChat(chatId, corpo);
        providerRef = resp.id || "";
      }
      await marcarEnviadoLinkedin(sb, target, target.campaign_id, step, etapas, providerRef, corpo);
      await liberarProximaAcaoConta(sb, conta.id, "mensagem", campanha.intervalo_min_seg, campanha.intervalo_max_seg);
    }
  } catch (e) {
    log(`Falha ao processar alvo (target=${target.id}, etapa=${step.tipo}): ${(e as Error).message}`);
    const corpoTentado = step.tipo === "convite" ? (step.nota || "") : (step.corpo || "");
    await marcarFalhaLinkedin(sb, target, target.campaign_id, step, step.tipo, (e as Error).message, corpoTentado);
  }
}

async function processarSheetWatcher(sb: SupabaseClient, campanha: LinkedinCampaignRow, log: (msg: string) => void) {
  const watcher = await obterSheetWatcherLinkedin(sb, campanha.id);
  if (!watcher) return;

  const profile = await getProfile(sb, campanha.user_id);
  const creds = (profile?.google_sheets_creds as GoogleSheetsCreds | null)?.oauth;
  if (!creds) {
    log(`Campanha ${campanha.id} (sheet_watch): usuário sem Google Sheets conectado.`);
    return;
  }

  let valores: string[][];
  try {
    valores = await lerValores(creds, watcher.sheet_id, watcher.aba_nome);
  } catch (e) {
    log(`Campanha ${campanha.id} (sheet_watch): erro ao ler planilha: ${(e as Error).message}`);
    return;
  }
  if (!valores.length) return;

  const [cabecalho, ...linhas] = valores;
  const jaProcessadas = watcher.ultima_linha_processada || 0;
  const novas = linhas.slice(jaProcessadas);
  if (!novas.length) return;

  const idxUrl = cabecalho.indexOf(watcher.coluna_url);
  if (idxUrl < 0) {
    log(`Campanha ${campanha.id} (sheet_watch): coluna de URL '${watcher.coluna_url}' não existe mais no cabeçalho.`);
    return;
  }
  const idxNome = watcher.coluna_nome ? cabecalho.indexOf(watcher.coluna_nome) : -1;

  const leads = novas.map((linha) => {
    const lead: Record<string, unknown> = {};
    cabecalho.forEach((col, i) => { lead[col] = linha[i] ?? ""; });
    lead.linkedin_url = linha[idxUrl] ?? "";
    lead.nome = idxNome >= 0 ? linha[idxNome] ?? "" : "";
    return lead;
  });

  const resultado = await enrollLinkedInTargets(sb, campanha.id, leads);
  await atualizarSheetWatcherLinkedin(sb, watcher.id, { ultima_linha_processada: linhas.length });
  log(`Campanha ${campanha.id} (sheet_watch): ${novas.length} linha(s) nova(s), ${resultado.inscritos} inscrita(s).`);
}

async function processarAutoTrigger(sb: SupabaseClient, campanha: LinkedinCampaignRow, log: (msg: string) => void) {
  const leads = await buscarLeadsFiltro(
    sb, campanha.user_id, campanha.filtro_nicho || "", campanha.filtro_subnicho || "",
    campanha.filtro_uf || "", campanha.ultimo_trigger_em,
  );
  const agoraIso = new Date().toISOString();
  if (!leads.length) {
    await atualizarCampanhaLinkedin(sb, campanha.id, { ultimo_trigger_em: agoraIso });
    return;
  }
  const resultado = await enrollLinkedInTargets(sb, campanha.id, leads);
  await atualizarCampanhaLinkedin(sb, campanha.id, { ultimo_trigger_em: agoraIso });
  log(`Campanha ${campanha.id} (auto_trigger): ${leads.length} lead(s) novo(s), ${resultado.inscritos} inscrito(s).`);
}

/** Fila de disparo por LinkedIn — roda a cada LINKEDIN_DISPATCH_TICK_MS. 1 ação por conta por tick (não em lote). */
export async function tickLinkedInDispatch(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  await requeueTravadosLinkedin(sb);
  const contas = await listarContasConectadas(sb);
  for (const conta of contas) {
    try {
      await processarConta(sb, conta, log);
    } catch (e) {
      log(`Erro processando conta ${conta.id}: ${(e as Error).message}`);
    }
  }
}

/** Scan lento de sheet_watch + auto_trigger de LinkedIn — roda a cada LINKEDIN_SHEET_WATCH_TICK_MS. */
export async function tickLinkedInSheetWatchAndAutoTrigger(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  for (const campanha of await listarCampanhasLinkedinSheetWatchAtivas(sb)) {
    try {
      await processarSheetWatcher(sb, campanha, log);
    } catch (e) {
      log(`Erro processando sheet_watch da campanha ${campanha.id}: ${(e as Error).message}`);
    }
  }
  for (const campanha of await listarCampanhasLinkedinAutoTriggerAtivas(sb)) {
    try {
      await processarAutoTrigger(sb, campanha, log);
    } catch (e) {
      log(`Erro processando auto_trigger da campanha ${campanha.id}: ${(e as Error).message}`);
    }
  }
}

/**
 * Rede de segurança atrás do webhook `new_relation` — roda bem devagar
 * (poucas vezes por dia, ver LINKEDIN_RELATIONS_POLL_MS em worker/index.ts)
 * porque a própria doc da Unipile recomenda não checar isso com frequência
 * pra não parecer automação. Detecta aceite pela AUSÊNCIA do provider_id
 * na lista de convites pendentes (`GET /users/invite/sent`) — se sumiu de
 * lá, foi aceito ou recusado.
 */
export async function tickLinkedInRelationsPoll(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  const contas = await listarContasConectadas(sb);
  for (const conta of contas) {
    if (!conta.unipile_account_id) continue;
    try {
      const alvosAguardando = await listarTargetsAguardandoAceitePorConta(sb, conta.id);
      if (!alvosAguardando.length) continue;

      const pendentes = await listarConvitesEnviados(conta.unipile_account_id);
      const providerIdsPendentes = new Set(pendentes.map((p) => p.provider_id));

      let liberados = 0;
      for (const alvo of alvosAguardando) {
        if (alvo.provider_id && !providerIdsPendentes.has(alvo.provider_id)) {
          await liberarAlvoAposAceite(sb, alvo);
          liberados += 1;
        }
      }
      if (liberados) log(`Conta ${conta.id}: ${liberados} alvo(s) liberado(s) via poll (convite não está mais pendente).`);
    } catch (e) {
      log(`Erro no poll de relações da conta ${conta.id}: ${(e as Error).message}`);
    }
  }
}
