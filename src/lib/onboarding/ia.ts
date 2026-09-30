import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { configPlataforma } from "@/lib/platform-settings";
import { statusConexoes } from "@/lib/conexoes";
import type { AcaoCredito, PlanRow, Profile } from "@/lib/database.types";
import {
  CENARIO_IDS, CENARIOS, LISTA_CENARIOS, lacunasDoCenario, normalizarFiltros, normalizarParametros, parametrosCenarioSchema,
  type Cenario, type CenarioId, type ParametrosCenario,
} from "./cenarios";
import { ajustarAoOrcamento, estimar, tamanhoBaseEstimado, toleranciaDe, type ContextoOrcamento, type Estimativa } from "./estimativa";
import { respostasLegiveis, type RespostasOnboarding } from "./questionario";
import { promptAvaliador, promptGerador, promptRevisao, type ContextoCliente } from "./prompt";
import { normalizarMensagens, revisarCopy, type ProblemaCopy } from "./copy";
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
  const [{ data: custosData }, { data: planoData }, conexoes] = await Promise.all([
    sb.from("credit_costs").select("acao, custo"),
    profile.plano_id ? sb.from("plans").select("*").eq("id", profile.plano_id).maybeSingle() : Promise.resolve({ data: null }),
    statusConexoes(sb, profile),
  ]);
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
    respostasTexto: respostasLegiveis(respostas),
    orcamento,
    cenariosDisponiveis,
    temChaveOpenai: Boolean(profile.openai_api_key) || respostas.temChaveOpenai === "sim",
    conexoesProntas: conexoes.filter((c) => c.disponivel && c.conectado).map((c) => c.label),
  };
  return ctx;
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
      problemasCopy: revisarCopy(mensagens, cenario.canais, cenario.variaveis),
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
  const precisaRevisar =
    avaliacao.avaliacoes.some((a) => a.veredito === "inviavel" || a.veredito === "arriscado") ||
    planos.some((p) => (p.problemasCopy ?? []).length > 0);
  if (precisaRevisar) {
    log("revisando planos com o parecer do avaliador");
    const entradaRevisao = [
      entradaCliente,
      "# Planos anteriores (com a estimativa real calculada pelo servidor)",
      resumoParaAvaliacao(planos),
      "# Avaliação",
      JSON.stringify(avaliacao, null, 1),
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
