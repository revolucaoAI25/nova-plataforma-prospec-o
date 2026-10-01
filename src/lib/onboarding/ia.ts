import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { configPlataforma } from "@/lib/platform-settings";
import { statusConexoes } from "@/lib/conexoes";
import { PLAN_FEATURE_FLAG_KEYS, type AcaoCredito, type PlanFeatureFlags, type PlanRow, type Profile } from "@/lib/database.types";
import {
  CENARIO_IDS, CENARIOS, LISTA_CENARIOS, lacunasDoCenario, normalizarFiltros, normalizarParametros, parametrosCenarioSchema,
  type Cenario, type CenarioId, type ParametrosCenario,
} from "./cenarios";
import {
  ajustarAoOrcamento, estimar, leadsParaMeta, tamanhoBaseEstimado, toleranciaDe, volumeAlvoDe,
  type ContextoOrcamento, type Estimativa, type PlanoVenda,
} from "./estimativa";
import { respostasLegiveis, type RespostasOnboarding } from "./questionario";
import { promptAvaliador, promptGerador, promptRevisao, type ContextoCliente } from "./prompt";
import { limparTracos, normalizarMensagens, revisarCopy, revisarMensagem, type ProblemaCopy } from "./copy";
import { ETAPAS_AUTOMATICAS, etapasDoFunil } from "./funil";

// ── Formatos de saída da IA (structured output) ───────────────────

const LETRAS = ["A", "B", "C", "D"] as const;
export type LetraPlano = (typeof LETRAS)[number];

const etapaTextoSchema = z.object({ atrasoHoras: z.number(), texto: z.string() });
const etapaEmailSchema = z.object({ atrasoHoras: z.number(), assunto: z.string(), corpo: z.string() });

export const mensagensSchema = z.object({
  whatsapp: z.array(etapaTextoSchema),
  email: z.array(etapaEmailSchema),
  linkedinNota: z.string().nullable(),
  linkedinMensagens: z.array(etapaTextoSchema),
  roteiroDm: z.string().nullable(),
  // Teste A/B que já nasce ligado: uma 2ª versão do 1º toque de cada canal
  // (metade dos leads recebe cada uma). Null = sem teste naquele canal.
  testeAB: z.object({
    whatsappAbertura: z.string().nullable(),
    emailAssunto: z.string().nullable(),
    linkedinNota: z.string().nullable(),
  }).nullable(),
});
export type MensagensPlano = z.infer<typeof mensagensSchema>;

const planoGeradoSchema = z.object({
  letra: z.enum(LETRAS),
  cenarioId: z.enum(CENARIO_IDS),
  titulo: z.string(),
  porQue: z.string(),
  comoFunciona: z.string(),
  parametros: parametrosCenarioSchema,
  mensagens: mensagensSchema,
  metricaSucesso: z.string(),
  quandoTrocar: z.string(),
  riscos: z.array(z.string()),
  etapasFunil: z.array(z.string()),
  // Onde o resultado acontece de verdade: o que responder quando o lead responde.
  respostasProntas: z.array(z.object({ situacao: z.string(), resposta: z.string() })),
});
type PlanoGerado = z.infer<typeof planoGeradoSchema>;

export const FONTES_PUBLICO = ["cnpj", "maps", "linkedin", "instagram"] as const;
export type FontePublico = (typeof FONTES_PUBLICO)[number];

const publicoSchema = z.object({
  nome: z.string(),
  porQue: z.string(),
  fonte: z.enum(FONTES_PUBLICO),
  parametros: parametrosCenarioSchema,
});

export const geracaoSchema = z.object({
  diagnostico: z.string(),
  planos: z.array(planoGeradoSchema),
  ordemSugerida: z.array(z.enum(LETRAS)),
  proximosPassos: z.string(),
  publicos: z.array(publicoSchema),
});
type Geracao = z.infer<typeof geracaoSchema>;

export const avaliacaoSchema = z.object({
  avaliacoes: z.array(
    z.object({
      letra: z.enum(LETRAS),
      nota: z.number(),
      veredito: z.enum(["recomendado", "viavel", "arriscado", "inviavel"]),
      pontosFortes: z.array(z.string()),
      pontosDeAtencao: z.array(z.string()),
      ajustes: z.string().nullable(),
    }),
  ),
  planoPrincipal: z.enum(LETRAS),
  parecer: z.string(),
});
type Avaliacao = z.infer<typeof avaliacaoSchema>;
export type AvaliacaoPlano = Avaliacao["avaliacoes"][number];

// ── Resultado persistido (onboarding.resultado) ───────────────────

export interface PlanoOnboarding {
  letra: LetraPlano;
  cenarioId: CenarioId;
  titulo: string;
  porQue: string;
  comoFunciona: string;
  parametros: ParametrosCenario;
  mensagens: MensagensPlano;
  metricaSucesso: string;
  quandoTrocar: string;
  riscos: string[];
  estimativa: Estimativa;
  ajustesAutomaticos: string[];
  lacunas: string[];
  avaliacao: AvaliacaoPlano | null;
  /** Etapas do funil depois da resposta (as automáticas são fixas — ver ETAPAS_AUTOMATICAS). Ausente em resultados antigos. */
  etapasFunil?: string[];
  /** O que o revisor automático de copy ainda aponta na versão final. */
  problemasCopy?: ProblemaCopy[];
  /** Respostas pra quando o lead responder. Ausente em resultados antigos. */
  respostasProntas?: { situacao: string; resposta: string }[];
}

/** Público pronto pra aplicar nas buscas avulsas (toggle "Sugestões" nos formulários). */
export interface PublicoSugerido {
  nome: string;
  porQue: string;
  fonte: FontePublico;
  parametros: ParametrosCenario;
}

export interface ResultadoOnboarding {
  diagnostico: string;
  planos: PlanoOnboarding[];
  ordemSugerida: LetraPlano[];
  proximosPassos: string;
  planoPrincipal: LetraPlano;
  parecer: string;
  revisado: boolean;
  modelo: string;
  orcamento: { creditosMes: number; origem: "plano" | "saldo"; nomePlano: string | null };
  geradoEm: string;
  /** Ausente em resultados gerados antes dessa versão. */
  publicos?: PublicoSugerido[];
}

export { ETAPAS_AUTOMATICAS, etapasDoFunil } from "./funil";

// ── Contexto ──────────────────────────────────────────────────────

async function montarContexto(sb: SupabaseClient, profile: Profile, respostas: RespostasOnboarding) {
  const [{ data: custosData }, { data: planoData }, { data: planosAtivos }, conexoes] = await Promise.all([
    sb.from("credit_costs").select("acao, custo"),
    profile.plano_id ? sb.from("plans").select("*").eq("id", profile.plano_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("plans").select("*").eq("ativo", true).order("creditos_mensais"),
    statusConexoes(sb, profile),
  ]);
  const planosVenda: PlanoVenda[] = ((planosAtivos ?? []) as PlanRow[]).map((pl) => ({
    nome: pl.nome,
    creditosMes: pl.creditos_mensais,
    precoCentavos: pl.preco_centavos,
    recursos: Object.fromEntries(PLAN_FEATURE_FLAG_KEYS.map((k) => [k, Boolean(pl[k])])) as unknown as PlanFeatureFlags,
  }));
  const custos = Object.fromEntries((custosData ?? []).map((c) => [c.acao, c.custo])) as Record<AcaoCredito, number>;
  const plano = planoData as PlanRow | null;
  const planoAtivo = plano && profile.assinatura_status === "ativa" ? plano : null;

  const orcamento: ContextoOrcamento = {
    creditosMes: planoAtivo ? Math.max(planoAtivo.creditos_mensais, 1) : Math.max(profile.creditos, 1),
    origemCreditos: planoAtivo ? "plano" : "saldo",
    nomePlano: planoAtivo?.nome ?? null,
    emailLimiteDiario: planoAtivo?.email_limite_diario ?? null,
    tolerancia: toleranciaDe(respostas.toleranciaRisco),
    tamanhoBase: tamanhoBaseEstimado(respostas.tamanhoBase),
    custos,
    volumeAlvoMes: volumeAlvoDe(respostas.volumeMensal as string | undefined),
    planosVenda,
  };

  const admin = profile.role === "admin";
  const semBase = !respostas.temBase || respostas.temBase === "nao";
  const cenariosDisponiveis = LISTA_CENARIOS.filter((c) => {
    if (c.fonte === "base_propria" && semBase) return false;
    if (admin) return true;
    if (profile.conta_teste && c.recursos.includes("linkedin_disparo_habilitado")) return false;
    return c.recursos.every((r) => profile[r]);
  });

  const ctx: ContextoCliente = {
    referenciasVolume: referenciasVolume(respostas, orcamento),
    respostasTexto: respostasLegiveis(respostas),
    orcamento,
    cenariosDisponiveis,
    temChaveOpenai: Boolean(profile.openai_api_key) || respostas.temChaveOpenai === "sim",
    conexoesProntas: conexoes.filter((c) => c.disponivel && c.conectado).map((c) => c.label),
  };
  return ctx;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Números que a IA usa pra dimensionar o volume — calculados aqui, nunca estimados por ela. */
function referenciasVolume(respostas: RespostasOnboarding, orc: ContextoOrcamento): string {
  const linhas: string[] = [];
  if (orc.volumeAlvoMes) linhas.push(`- Volume que o cliente quer abordar: ~${fmt(orc.volumeAlvoMes)} contatos novos/mês (meio da faixa que ele marcou).`);
  const meta = Number(String(respostas.metaReunioes ?? "").replace(/\D/g, ""));
  if (meta > 0) {
    linhas.push(`- Meta de ${fmt(meta)} reuniões/vendas por mês. Conta de trás pra frente (resposta × conversa que vira reunião, referências conservadoras): WhatsApp ~${fmt(leadsParaMeta(meta, "whatsapp"))} leads/mês, e-mail ~${fmt(leadsParaMeta(meta, "email"))}, LinkedIn ~${fmt(leadsParaMeta(meta, "linkedin"))}.`);
  }
  const conversasDia: Record<string, number> = { ate_10: 10, "10_30": 20, "30_100": 60, acima_100: 150 };
  const capacidade = conversasDia[String(respostas.capacidadeRespostas ?? "")];
  if (capacidade) {
    // Base fria: ~10% de resposta. O time limita conversas, então o teto de
    // CONTATOS é conversas ÷ taxa de resposta — bem maior que as conversas.
    linhas.push(`- O time atende ~${capacidade} conversas novas/dia. Base fria responde ~10%, então isso comporta ~${fmt(capacidade * 10)} contatos novos/dia (~${fmt(capacidade * 10 * 22)}/mês) antes de faltar gente pra responder. Na prática, quem limita é o canal, não o time.`);
  }
  const porNumero: Record<string, number> = { conservador: 60, equilibrado: 120, agressivo: 200 };
  const msgsDia = porNumero[orc.tolerancia] ?? 120;
  linhas.push(`- Um número de WhatsApp, na tolerância dele, envia ~${msgsDia} mensagens/dia contando follow-ups: com 5 toques, ~${fmt(Math.floor((msgsDia * 22) / 4.5))} leads novos/mês por número.`);
  if (orc.planosVenda.length) {
    linhas.push(`- Planos à venda (créditos/mês): ${orc.planosVenda.map((p) => `${p.nome} ${fmt(p.creditosMes)}`).join(", ")}.`);
  }
  return linhas.join("\n");
}

/**
 * Checagens determinísticas que forçam revisão mesmo se a avaliadora deixar
 * passar: público com CNPJ sem nenhuma sugestão na base de CNPJ, e sugestão
 * barata muito abaixo do volume que o cliente pediu.
 */
function ajustesObrigatorios(planos: PlanoOnboarding[], ctx: ContextoCliente, respostas: RespostasOnboarding): string[] {
  const ajustes: string[] = [];
  // Empresa média/grande costuma ser cargo (LinkedIn); pessoa física não tem CNPJ.
  const publicoComCnpj = !["pessoas_fisicas", "empresas_medias_grandes"].includes(String(respostas.tipoCliente ?? ""));
  const temCnpjDisponivel = ctx.cenariosDisponiveis.some((c) => c.fonte === "cnpj");
  if (publicoComCnpj && temCnpjDisponivel && !planos.some((p) => CENARIOS[p.cenarioId].fonte === "cnpj")) {
    ajustes.push("Nenhuma sugestão usa a base de CNPJ, e o público tem CNPJ. Reavalie: troque a sugestão mais fraca por uma com base de CNPJ (de volume, como cnpj_whatsapp, ou qualificada, como cnpj_decisor_whatsapp), OU mantenha as atuais e explique no diagnóstico por que a base de CNPJ não serve pra esse cliente.");
  }
  // O outro lado da mesma moeda: não deixar a recomendação de CNPJ virar
  // "tudo CNPJ" quando outra fonte disponível serviria melhor pra parte delas.
  const fontes = planos.map((p) => CENARIOS[p.cenarioId].fonte);
  const outrasFontes = new Set(ctx.cenariosDisponiveis.map((c) => c.fonte).filter((f) => f !== "cnpj" && f !== "base_propria"));
  if (planos.length >= 3 && fontes.every((f) => f === "cnpj") && outrasFontes.size > 0) {
    ajustes.push("Todas as sugestões usam a base de CNPJ. Reavalie, pelos critérios de escolha de fonte, se pelo menos uma não ficaria melhor com outra fonte disponível; se CNPJ for mesmo o melhor caminho em todas, explique no diagnóstico o que muda entre elas.");
  }
  const perfis = new Set(planos.map((p) => p.estimativa.perfil));
  if (planos.length >= 3 && !perfis.has("qualificada") && ctx.cenariosDisponiveis.some((c) => c.acoesPorLead.includes("bigdatacorp") || c.usaOpenai)) {
    ajustes.push("Todas as sugestões são de volume. Se o ticket comportar, troque uma por uma versão qualificada (menos leads, sócio/decisor e contato validados ou pesquisa por IA) pra ele comparar volume x precisão; se não comportar, explique no diagnóstico.");
  }
  const alvo = ctx.orcamento.volumeAlvoMes;
  if (alvo) {
    const baixas = planos.filter((p) => p.estimativa.custoPorLead <= 10 && !p.estimativa.usaOpenai && p.estimativa.leadsAbordadosMes < alvo * 0.4 && CENARIOS[p.cenarioId].fonte !== "linkedin");
    if (baixas.length) {
      ajustes.push(`As sugestões ${baixas.map((p) => p.letra).join(", ")} abordam bem menos do que os ~${fmt(alvo)} contatos/mês que o cliente quer. Aumente leadsPorExecucao (ou os dias da semana) até perto da meta, dentro do que o canal aguenta.`);
    }
  }
  return ajustes;
}

// ── Chamadas ──────────────────────────────────────────────────────

// GPT-5.6 Luna: o tier mais barato da família 5.6 (equivalente ao antigo
// "nano"), com structured outputs e raciocínio ajustável. Trocável sem
// deploy em Chaves da plataforma (onboarding_modelo_ia) — ex.: gpt-5.6-terra
// se quiser mais qualidade por um custo maior.
const MODELO_PADRAO = "gpt-5.6-luna";

async function clienteIa(): Promise<{ client: OpenAI; modelo: string }> {
  const chave = await configPlataforma("openai_api_key_plataforma", process.env.OPENAI_API_KEY);
  if (!chave) throw new Error("A IA do onboarding não está configurada (chave OpenAI da plataforma ausente).");
  const modelo = (await configPlataforma("onboarding_modelo_ia", process.env.ONBOARDING_MODELO_IA)) || MODELO_PADRAO;
  return { client: new OpenAI({ apiKey: chave }), modelo };
}

async function chamar<T extends z.ZodTypeAny>(
  ia: { client: OpenAI; modelo: string },
  instrucoes: string,
  entrada: string,
  schema: T,
  nome: string,
): Promise<z.infer<T>> {
  let ultimoErro: unknown = null;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const resp = await ia.client.responses.parse(
        {
          model: ia.modelo,
          instructions: instrucoes,
          input: entrada,
          reasoning: { effort: "medium" },
          text: { format: zodTextFormat(schema, nome) },
        },
        { timeout: 300_000 },
      );
      if (resp.output_parsed) return resp.output_parsed as z.infer<T>;
      ultimoErro = new Error("A IA não devolveu uma resposta no formato esperado.");
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

// ── Pós-processamento determinístico ──────────────────────────────

function processarPlanos(geracao: Geracao, ctx: ContextoCliente): PlanoOnboarding[] {
  const disponiveis = new Set<CenarioId>(ctx.cenariosDisponiveis.map((c) => c.id));
  const validos = geracao.planos.filter((p) => disponiveis.has(p.cenarioId)).slice(0, 4);

  return validos.map((p: PlanoGerado, i) => {
    const cenario: Cenario = CENARIOS[p.cenarioId];
    const normalizados = normalizarParametros(p.parametros, cenario);
    const { parametros, ajustes } = ajustarAoOrcamento(cenario, normalizados, ctx.orcamento);
    const mensagens = normalizarMensagens(p.mensagens);
    const respostasProntas = (p.respostasProntas ?? [])
      .map((r) => ({ situacao: limparTracos(r.situacao.trim()), resposta: limparTracos(r.resposta.trim()) }))
      .filter((r) => r.situacao && r.resposta)
      .slice(0, 6);
    return {
      ...p,
      letra: LETRAS[i],
      parametros,
      mensagens,
      estimativa: estimar(cenario, parametros, ctx.orcamento),
      ajustesAutomaticos: ajustes,
      lacunas: lacunasDoCenario(parametros, cenario),
      avaliacao: null,
      etapasFunil: etapasDoFunil(p).slice(ETAPAS_AUTOMATICAS.length),
      problemasCopy: [
        ...revisarCopy(mensagens, cenario.canais, cenario.variaveis),
        ...respostasProntas.flatMap((r, j) => revisarMensagem("whatsapp", r.resposta, 1).map((problema) => ({ onde: `Resposta pronta ${j + 1}`, problema }))),
      ],
      respostasProntas,
    };
  });
}

function processarPublicos(geracao: Geracao): PublicoSugerido[] {
  return geracao.publicos
    .map((p) => ({ nome: p.nome.trim().slice(0, 80), porQue: p.porQue.trim(), fonte: p.fonte, parametros: normalizarFiltros(p.parametros) }))
    .filter((p) => {
      const f = p.parametros;
      if (!p.nome) return false;
      if (p.fonte === "cnpj") return f.cnaes.length > 0;
      if (p.fonte === "maps") return Boolean(f.nichoMaps || f.termoMaps);
      if (p.fonte === "linkedin") return f.cargosLinkedin.length > 0 || Boolean(f.palavraChaveLinkedin);
      return Boolean(f.perfilInstagram);
    })
    .slice(0, 8);
}

function resumoParaAvaliacao(planos: PlanoOnboarding[]): string {
  return JSON.stringify(
    planos.map((p) => ({
      letra: p.letra,
      cenario: `${p.cenarioId} — ${CENARIOS[p.cenarioId].nome}`,
      titulo: p.titulo,
      porQue: p.porQue,
      parametros: p.parametros,
      mensagens: p.mensagens,
      riscosDeclarados: p.riscos,
      estimativaCalculadaPeloServidor: {
        custoPorLead: p.estimativa.custoPorLead,
        leadsExtraidosMes: p.estimativa.leadsExtraidosMes,
        leadsAbordadosMes: p.estimativa.leadsAbordadosMes,
        creditosMes: p.estimativa.creditosMes,
        percentualDoOrcamento: Math.round(p.estimativa.percentualOrcamento * 100),
        gargalo: p.estimativa.gargalo,
      },
      ajustesAutomaticos: p.ajustesAutomaticos,
      lacunas: p.lacunas,
      etapasFunil: etapasDoFunil(p),
      problemasDeCopy: p.problemasCopy ?? [],
      respostasProntas: p.respostasProntas ?? [],
      reunioesEstimadasMes: p.estimativa.reunioesMes ?? null,
    })),
    null,
    1,
  );
}

function aplicarAvaliacao(planos: PlanoOnboarding[], avaliacao: Avaliacao): PlanoOnboarding[] {
  return planos.map((p) => ({ ...p, avaliacao: avaliacao.avaliacoes.find((a) => a.letra === p.letra) ?? null }));
}

// ── Pipeline ──────────────────────────────────────────────────────

/**
 * Gera → calcula custo/volume → avalia → (se o avaliador reprovar algum
 * plano) revisa uma vez → recalcula → reavalia. A revisão é limitada a uma
 * rodada: se ainda sobrar plano arriscado, ele aparece pro cliente com os
 * pontos de atenção, em vez de a geração ficar em loop.
 */
export async function gerarPlanosOnboarding(
  sb: SupabaseClient,
  profile: Profile,
  respostas: RespostasOnboarding,
  log: (m: string) => void = () => {},
): Promise<ResultadoOnboarding> {
  const ctx = await montarContexto(sb, profile, respostas);
  if (!ctx.cenariosDisponiveis.length) throw new Error("Nenhum cenário de prospecção está liberado para esta conta.");

  const ia = await clienteIa();
  const instrucoesGerador = promptGerador(ctx);
  const entradaCliente = `# Respostas do onboarding\n${ctx.respostasTexto}`;

  log(`gerando planos (${ia.modelo})`);
  let geracao = await chamar(ia, instrucoesGerador, entradaCliente, geracaoSchema, "planos_prospeccao");
  let planos = processarPlanos(geracao, ctx);
  if (!planos.length) throw new Error("A IA não montou nenhum plano com os cenários disponíveis.");

  log("avaliando planos");
  let avaliacao = await chamar(ia, promptAvaliador(ctx), resumoParaAvaliacao(planos), avaliacaoSchema, "avaliacao_planos");

  // Revisa se a avaliadora reprovou algo OU se o revisor de copy achou
  // marca de texto robótico — isso nunca deve chegar no cliente.
  const obrigatorios = ajustesObrigatorios(planos, ctx, respostas);
  const precisaRevisar =
    avaliacao.avaliacoes.some((a) => a.veredito === "inviavel" || a.veredito === "arriscado") ||
    planos.some((p) => (p.problemasCopy ?? []).length > 0) ||
    obrigatorios.length > 0;
  if (precisaRevisar) {
    log("revisando planos com o parecer do avaliador");
    const entradaRevisao = [
      entradaCliente,
      "# Planos anteriores (com a estimativa real calculada pelo servidor)",
      resumoParaAvaliacao(planos),
      "# Avaliação",
      JSON.stringify(avaliacao, null, 1),
      ...(obrigatorios.length ? ["# Ajustes obrigatórios (checados pelo servidor)", obrigatorios.map((a) => `- ${a}`).join("\n")] : []),
      promptRevisao(),
    ].join("\n\n");
    geracao = await chamar(ia, instrucoesGerador, entradaRevisao, geracaoSchema, "planos_prospeccao");
    const revisados = processarPlanos(geracao, ctx);
    if (revisados.length) {
      planos = revisados;
      log("reavaliando planos revisados");
      avaliacao = await chamar(ia, promptAvaliador(ctx), resumoParaAvaliacao(planos), avaliacaoSchema, "avaliacao_planos");
    }
  }

  planos = aplicarAvaliacao(planos, avaliacao);
  const publicos = processarPublicos(geracao);
  const letrasValidas = new Set(planos.map((p) => p.letra));
  const ordem = geracao.ordemSugerida.filter((l) => letrasValidas.has(l));

  return {
    diagnostico: geracao.diagnostico,
    planos,
    ordemSugerida: ordem.length ? ordem : planos.map((p) => p.letra),
    proximosPassos: geracao.proximosPassos,
    planoPrincipal: letrasValidas.has(avaliacao.planoPrincipal) ? avaliacao.planoPrincipal : planos[0].letra,
    parecer: avaliacao.parecer,
    revisado: precisaRevisar,
    modelo: ia.modelo,
    orcamento: { creditosMes: ctx.orcamento.creditosMes, origem: ctx.orcamento.origemCreditos, nomePlano: ctx.orcamento.nomePlano },
    geradoEm: new Date().toISOString(),
    publicos,
  };
}
