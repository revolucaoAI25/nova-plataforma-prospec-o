/**
 * E-mails de retomada: quem está no teste grátis e não assinou, e quem criou a
 * conta na contratação mas não concluiu o pagamento. Cada pessoa recebe no
 * máximo uma etapa por vez (a mais recente que já venceu); as etapas enviadas
 * ficam em profiles.emails_retomada e o descadastro em emails_retomada_off.
 *
 * Só envia com o remetente da plataforma configurado em /admin
 * (email_remetente_plataforma, num domínio verificado no Resend) e com
 * NEXT_PUBLIC_APP_URL definido (os links dos e-mails apontam para ele).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { configPlataforma } from "../src/lib/platform-settings";
import { enviarEmail, textoParaHtml } from "../src/lib/integrations/resend";
import { diasTesteGratis } from "../src/lib/teste-gratis";
import { obterPrimeiraFaturaAssinatura } from "../src/lib/integrations/asaas";
import { tokenWebhook, urlBaseApp } from "../src/lib/webhook-token";

const HORA = 3_600_000;
const LOTE = 40;

interface Pessoa {
  id: string;
  email: string | null;
  nome: string | null;
  created_at: string;
  teste_gratis: boolean;
  assinatura_status: string;
  asaas_subscription_id: string | null;
  plano_id: string | null;
  emails_retomada: Record<string, string> | null;
}

interface Etapa {
  id: string;
  /** Horas desde a criação da conta para a etapa vencer. */
  apos: number;
  assunto: (p: Ctx) => string;
  texto: (p: Ctx) => string;
}

interface Ctx {
  nome: string;
  base: string;
  preco: string | null;
  plano: string | null;
  fatura: string | null;
}

const linha = (preco: string | null) => (preco ? `Planos a partir de ${preco}/mês, mensal sem fidelidade e com garantia de 7 dias.` : "Mensal sem fidelidade e com garantia de 7 dias.");

export function etapasTeste(dias: number): Etapa[] {
  const etapas: Etapa[] = [
    {
      id: "t1",
      apos: 20,
      assunto: (c) => `${c.nome}, já viu quem são os seus próximos clientes?`,
      texto: (c) =>
        `Oi, ${c.nome}!\n\nSeu teste grátis do Leadmatic está ativo. Se ainda não fez a primeira busca, vale começar por ela: escolha o segmento e a cidade no Google Maps e veja as empresas do seu público, com nota, avaliações e telefone.\n\nLeva menos de um minuto: ${c.base}/busca/maps\n\nQualquer dúvida, é só responder este e-mail.`,
    },
    {
      id: "t3",
      apos: 72,
      assunto: () => "A lista é o começo. O que gera reunião é o resto",
      texto: (c) =>
        `Oi, ${c.nome}!\n\nNo teste você vê a lista de empresas. Quem assina recebe o que transforma essa lista em reunião:\n\n• a IA monta a estratégia: público, mensagens e cadência\n• encontra o sócio e o celular de quem decide em cada empresa\n• aborda por WhatsApp, e-mail e LinkedIn, com follow-up no dia certo\n• e avisa quando alguém responde, com o lead já no funil\n\n${linha(c.preco)}\n\n${c.base}/creditos`,
    },
  ];
  if (dias >= 2) {
    etapas.push({
      id: "t_fim",
      apos: (dias - 1) * 24,
      assunto: () => "Seu teste grátis termina amanhã",
      texto: (c) =>
        `Oi, ${c.nome}!\n\nAmanhã o seu teste grátis termina e a busca fica bloqueada. Se a qualidade dos contatos fez sentido, assine hoje e continue com tudo o que já montou, agora com a IA abordando essas empresas por você.\n\n${linha(c.preco)}\n\n${c.base}/creditos`,
    });
  }
  if (dias >= 1) {
    etapas.push(
      {
        id: "t_encerrado",
        apos: dias * 24 + 2,
        assunto: () => "Seu teste terminou, mas as suas empresas continuam lá",
        texto: (c) =>
          `Oi, ${c.nome}!\n\nO seu teste grátis terminou. As empresas que você encontrou continuam salvas no seu histórico: assine para continuar de onde parou, com a abordagem e o follow-up rodando sozinhos.\n\n${linha(c.preco)}\n\n${c.base}/creditos`,
      },
      {
        id: "t_ultima",
        apos: (dias + 5) * 24,
        assunto: () => "Posso te ajudar a decidir?",
        texto: (c) =>
          `Oi, ${c.nome}!\n\nVi que você testou o Leadmatic e não seguiu. Se ficou alguma dúvida, sobre o preço, o risco para o seu WhatsApp ou se funciona para o seu mercado, responda este e-mail que a gente te ajuda.\n\nSe preferir, os planos estão aqui: ${c.base}/creditos`,
      },
    );
  }
  // Em ordem de tempo (a escolha da etapa depende disso). Num teste curto, o
  // e-mail de valor cairia depois do fim do teste: aí ele sai.
  const fimTeste = dias >= 1 ? dias * 24 + 2 : Infinity;
  return etapas.filter((e) => e.id !== "t3" || e.apos < fimTeste - 24).sort((x, y) => x.apos - y.apos);
}

export const ETAPAS_PAGAMENTO: Etapa[] = [
  {
    id: "p1",
    apos: 1,
    assunto: () => "Falta só o pagamento para liberar o Leadmatic",
    texto: (c) =>
      `Oi, ${c.nome}!\n\nA sua conta está criada${c.plano ? ` e a assinatura do plano ${c.plano} foi gerada` : ""}. Falta só concluir o pagamento no cartão:\n\n${c.fatura ?? `${c.base}/bem-vindo`}\n\nAssim que ele for aprovado, a plataforma é liberada na hora e a IA monta a sua estratégia de prospecção.`,
  },
  {
    id: "p2",
    apos: 24,
    assunto: () => "A sua assinatura está esperando",
    texto: (c) =>
      `Oi, ${c.nome}!\n\nA sua assinatura do Leadmatic ainda está aguardando o pagamento. Leva um minuto e, com o cartão aprovado, os créditos entram na hora:\n\n${c.fatura ?? `${c.base}/bem-vindo`}\n\nGarantia de 7 dias: se não fizer sentido, devolvemos 100% do valor.`,
  },
  {
    id: "p3",
    apos: 72,
    assunto: () => "Ficou alguma dúvida antes de assinar?",
    texto: (c) =>
      `Oi, ${c.nome}!\n\nVi que você começou a assinatura do Leadmatic e não concluiu. Se ficou alguma dúvida, é só responder este e-mail. Se quiser continuar, a fatura está aqui:\n\n${c.fatura ?? `${c.base}/bem-vindo`}`,
  },
];

/** A etapa mais recente que já venceu e ainda não foi enviada; as anteriores ficam marcadas como puladas. */
export function proximaEtapa(etapas: Etapa[], pessoa: Pessoa, agora: number): { etapa: Etapa; puladas: Etapa[] } | null {
  const horas = (agora - new Date(pessoa.created_at).getTime()) / HORA;
  const enviadas = pessoa.emails_retomada ?? {};
  const vencidas = etapas.filter((e) => horas >= e.apos);
  const atual = vencidas[vencidas.length - 1];
  if (!atual || enviadas[atual.id]) return null;
  return { etapa: atual, puladas: vencidas.slice(0, -1).filter((e) => !enviadas[e.id]) };
}

export async function tickRetomada(sb: SupabaseClient, log: (msg: string) => void): Promise<void> {
  const remetente = (await configPlataforma("email_remetente_plataforma", process.env.EMAIL_REMETENTE_PLATAFORMA)).trim();
  const base = urlBaseApp();
  if (!remetente || !base) return;

  const agora = Date.now();
  const dias = await diasTesteGratis();
  const desde = new Date(agora - 30 * 24 * HORA).toISOString();
  const { data, error } = await sb
    .from("profiles")
    .select("id, email, nome, created_at, teste_gratis, assinatura_status, asaas_subscription_id, plano_id, emails_retomada")
    .eq("emails_retomada_off", false)
    .neq("role", "admin")
    .neq("assinatura_status", "ativa")
    .gte("created_at", desde)
    .or("teste_gratis.eq.true,assinatura_status.eq.pendente")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) {
    // Sem a migration 0046 as colunas não existem: não há o que fazer ainda.
    if (!/emails_retomada/.test(error.message)) log(`erro ao listar: ${error.message}`);
    return;
  }

  const { data: planos } = await sb.from("plans").select("id, nome, preco_centavos").eq("ativo", true).order("preco_centavos");
  const listaPlanos = (planos ?? []) as { id: string; nome: string; preco_centavos: number }[];
  const preco = listaPlanos[0] ? (listaPlanos[0].preco_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
  const etapasDoTeste = etapasTeste(dias);

  let enviados = 0;
  for (const pessoa of (data ?? []) as Pessoa[]) {
    if (enviados >= LOTE) break;
    if (!pessoa.email) continue;
    const pagamento = pessoa.assinatura_status === "pendente" && !pessoa.teste_gratis;
    const escolha = proximaEtapa(pagamento ? ETAPAS_PAGAMENTO : etapasDoTeste, pessoa, agora);
    if (!escolha) continue;

    let fatura: string | null = null;
    if (pagamento && pessoa.asaas_subscription_id) {
      fatura = await obterPrimeiraFaturaAssinatura(pessoa.asaas_subscription_id).then((f) => f?.invoiceUrl ?? null).catch(() => null);
    }
    const ctx: Ctx = {
      nome: (pessoa.nome ?? "").trim().split(/\s+/)[0] || "tudo bem",
      base,
      preco,
      plano: listaPlanos.find((p) => p.id === pessoa.plano_id)?.nome ?? null,
      fatura,
    };
    const sair = `${base}/api/retomada/sair?u=${pessoa.id}&t=${await tokenWebhook(`retomada:${pessoa.id}`)}`;
    const texto = `${escolha.etapa.texto(ctx)}\n\n—\nEquipe Leadmatic\n\nPara não receber mais estes e-mails: ${sair}`;

    // Marca antes de enviar: na dúvida, prefere não repetir um e-mail a mandar duas vezes.
    const marcadas = { ...(pessoa.emails_retomada ?? {}) };
    const agoraIso = new Date(agora).toISOString();
    for (const e of escolha.puladas) marcadas[e.id] = `pulada:${agoraIso}`;
    marcadas[escolha.etapa.id] = agoraIso;
    const { error: erroMarca } = await sb.from("profiles").update({ emails_retomada: marcadas }).eq("id", pessoa.id);
    if (erroMarca) {
      log(`não marcou ${escolha.etapa.id} de ${pessoa.id}: ${erroMarca.message}`);
      continue;
    }
    try {
      await enviarEmail({
        from: remetente,
        to: pessoa.email,
        replyTo: remetente.match(/<([^>]+)>/)?.[1] ?? remetente,
        subject: escolha.etapa.assunto(ctx),
        text: texto,
        html: textoParaHtml(texto),
      });
      enviados += 1;
    } catch (err) {
      log(`falha ao enviar ${escolha.etapa.id} para ${pessoa.id}: ${(err as Error).message}`);
    }
  }
  if (enviados) log(`${enviados} e-mail(s) de retomada enviados`);
}
