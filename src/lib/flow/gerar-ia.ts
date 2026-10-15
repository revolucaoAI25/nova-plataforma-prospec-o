import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chamar, clienteIa } from "@/lib/onboarding/ia";
import { limparTracos } from "@/lib/onboarding/copy";
import { CNAES } from "@/lib/data/cnaes";
import type { FlowEdge, FlowNode, FlowNodeTipo, GoogleSheetsCreds, Json, PlanFeatureFlags, Profile } from "@/lib/database.types";
import { FLOW_NODE_TYPES, FLOW_NODE_TYPES_LIST, saidasValidas, validarEstruturaFluxo, type FlowNodeTypeMeta } from "./node-types";
import { alturaEstimada, posicoesEmArvore } from "./layout";

/**
 * "Criar com IA": a pessoa descreve a estratégia em texto livre e a IA
 * monta o fluxo (módulos, configuração e conexões, inclusive os ramos).
 *
 * A IA só propõe; o que ela devolve passa por um saneamento determinístico
 * antes de virar fluxo: tipos e saídas que não existem caem fora, ids de
 * campanha/funil/planilha que não são da conta viram vazios (e entram em
 * "o que falta"), CNAEs são normalizados, loops e conexões repetidas são
 * descartados e o fluxo sempre sai com exatamente um gatilho. O fluxo é
 * salvo pausado: nada roda até a pessoa revisar e ativar.
 */

/** Módulo que depende de um recurso do plano. */
const FLAG_DO_TIPO: Partial<Record<FlowNodeTipo, keyof PlanFeatureFlags>> = {
  disparo_whatsapp: "disparo_habilitado",
  disparo_email: "email_disparo_habilitado",
  disparo_linkedin: "linkedin_disparo_habilitado",
  extracao_instagram: "instagram_visible",
  extracao_linkedin: "linkedin_visible",
  enriquecimento_ia: "enriquecimento_ia_habilitado",
  enriquecimento_bigdatacorp: "bigdatacorp_enrichment_habilitado",
};

const TIPOS = FLOW_NODE_TYPES_LIST.filter((t) => t.disponivel).map((t) => t.tipo) as [FlowNodeTipo, ...FlowNodeTipo[]];
const TODAS_SAIDAS = Array.from(new Set(FLOW_NODE_TYPES_LIST.flatMap((t) => (t.saidas ?? []).map((s) => s.id))));

export const respostaSchema = z.object({
  nome: z.string(),
  nos: z.array(z.object({
    ref: z.string(),
    tipo: z.enum(TIPOS),
    // Config varia por tipo: vem como JSON em texto e é validada aqui.
    configJson: z.string(),
  })),
  conexoes: z.array(z.object({
    de: z.string(),
    para: z.string(),
    saida: z.enum(["principal", ...TODAS_SAIDAS] as [string, ...string[]]),
  })),
  explicacao: z.string(),
  oQueFalta: z.array(z.string()),
});

export type RespostaIa = z.infer<typeof respostaSchema>;

// ── Contexto da conta ────────────────────────────────────────────────

export interface Recursos {
  campanhasWhatsapp: { id: string; nome: string }[];
  campanhasEmail: { id: string; nome: string }[];
  remetentesEmail: { id: string; nome: string }[];
  campanhasLinkedin: { id: string; nome: string }[];
  contasLinkedin: { id: string; nome: string }[];
  funis: { id: string; nome: string; colunas: { id: string; nome: string }[] }[];
  planilhas: { id: string; nome: string; aba: string }[];
  custos: Record<string, number>;
}

async function carregarRecursos(sb: SupabaseClient, userId: string, profile: Profile): Promise<Recursos> {
  const lista = async (tabela: string) => {
    const { data } = await sb.from(tabela).select("id, nome").eq("user_id", userId).limit(50);
    return ((data ?? []) as { id: string; nome: string }[]);
  };
  const [campanhasWhatsapp, campanhasEmail, remetentesEmail, campanhasLinkedin, contasLinkedin, funisBase, custosData] = await Promise.all([
    lista("dispatch_campaigns"), lista("email_campaigns"), lista("email_senders"),
    lista("linkedin_campaigns"), lista("linkedin_accounts"), lista("funis"),
    sb.from("credit_costs").select("acao, custo").then((r) => r.data ?? []),
  ]);
  const { data: colunas } = funisBase.length
    ? await sb.from("funil_colunas").select("id, nome, funil_id, ordem").in("funil_id", funisBase.map((f) => f.id)).order("ordem")
    : { data: [] };
  const funis = funisBase.map((f) => ({
    ...f,
    colunas: ((colunas ?? []) as { id: string; nome: string; funil_id: string }[]).filter((c) => c.funil_id === f.id).map(({ id, nome }) => ({ id, nome })),
  }));
  const planilhas = ((profile.google_sheets_creds as GoogleSheetsCreds | null)?.planilhas ?? []).map(({ id, nome, aba }) => ({ id, nome, aba }));
  const custos = Object.fromEntries((custosData as { acao: string; custo: number }[]).map((c) => [c.acao, Number(c.custo)]));
  return { campanhasWhatsapp, campanhasEmail, remetentesEmail, campanhasLinkedin, contasLinkedin, funis, planilhas, custos };
}

// ── Prompt ───────────────────────────────────────────────────────────

function descreverTipo(meta: FlowNodeTypeMeta, liberado: boolean): string {
  let schema = "";
  try {
    schema = JSON.stringify(z.toJSONSchema(meta.configSchema, { unrepresentable: "any" }));
  } catch {
    schema = "{}";
  }
  const saidas = meta.saidas?.length
    ? `\n  Saídas: "principal" (${meta.rotuloSaidaPrincipal}) ${meta.saidas.map((s) => `| "${s.id}" (${s.label}: ${s.descricao})`).join(" ")}`
    : "";
  return `- ${meta.tipo} [${meta.categoria}] ${meta.label}${liberado ? "" : " (NÃO liberado no plano desta conta: evite)"}: ${meta.descricao}${saidas}\n  Config (JSON Schema): ${schema}`;
}

const INSTRUCOES = `Você monta fluxos de automação de prospecção no Leadmatic a partir da estratégia que o usuário descrever.

Como o fluxo funciona:
- Exatamente 1 gatilho (categoria "gatilho"), que inicia o fluxo. Use gatilho_agendado para rotina (ex.: dias úteis às 08:00) e gatilho_manual quando o usuário quiser rodar quando quiser.
- Os leads passam de módulo em módulo como um lote. Conexão "principal" segue em frente; saídas extras abrem caminhos alternativos (ramos).
- filtro_leads separa o lote: quem atende segue pela principal, quem não atende sai por "nao_atende" (se ligada).
- Disparos (WhatsApp, e-mail, LinkedIn) só inscrevem os leads numa campanha existente; o texto das mensagens fica na campanha, não no fluxo. Saídas: "principal" (segue na hora com os inscritos), "enviou", "falhou" (contato inválido ou erro no envio), "respondeu", "sem_resposta" (cadência acabou sem resposta, depois de horasSemResposta).
- enriquecimento_bigdatacorp (Celular do sócio) acha o celular pessoal com WhatsApp do sócio de cada lead com CNPJ e o coloca no campo telefone (o da empresa vai para telefone_empresa). É o jeito de falar direto com o dono. Saídas: "principal" (achou celular) e "sem_celular" (não achou ou sem CNPJ; se não ligar, esses seguem pela principal com o telefone da empresa). Padrão para economizar: disparo no telefone da empresa → "falhou" ou "sem_resposta" → enriquecimento_bigdatacorp → disparo de novo (só paga o celular de quem não deu certo). Para falar com o dono desde o início: extracao_cnpj → enriquecimento_bigdatacorp → disparo, e "sem_celular" → disparo no telefone da empresa.
- Leads que saem por "falhou" trazem o campo contato_que_falhou. Depois do enriquecimento_bigdatacorp, um filtro_leads com campo "telefone", operador "diferente_do_campo", valor "contato_que_falhou" garante que o novo disparo vai para um número diferente.
- Sem resposta num canal → disparo em outro canal é um bom padrão multicanal.

Dados que você precisa saber:
- extracao_cnpj: CNAEs com 7 dígitos sem pontuação (ex.: "5611201" restaurantes, "5611203" lanchonetes, "5611205" bares, "5620104" delivery/marmitaria, "1091102" padarias). "municipio" é a lista de nomes de cidades por extenso, com acento (ex.: ["Santo André","São Bernardo do Campo"]), junto com "uf" (ex.: ["SP"]). Para uma região (ex.: ABC Paulista), prefira uma cidade central + "raioVizinhosKm" (ex.: ["Santo André"] + 15 inclui São Bernardo, São Caetano, Diadema, Mauá e Ribeirão Pires). "bairro"/"cep" só quando o usuário pedir bairros ou CEPs específicos. Porte: "01" microempresa, "03" empresa de pequeno porte, "05" demais. Para disparo por WhatsApp prefira tipoTelefone "celular". meiOptante "excluir" quando o público tem que ter verba. Use limite coerente com o volume pedido.
- Campos do lead depois da extração CNPJ: nome, telefone, email, cnpj, porte ("MICRO EMPRESA", "EMPRESA DE PEQUENO PORTE", "DEMAIS"), socio_principal, municipio, uf, capital_social. Depois do Maps: avaliacao, total_avaliacoes, site. Depois do enriquecimento_bigdatacorp: socio_nome, socio_cargo, socio_celular, telefone_empresa.
- extracao_maps não traz CNPJ nem sócio; é melhor quando o que importa é presença no Google (avaliações). Para "perto de um endereço/bairro", use raioEndereco (ex.: "Av. Industrial, Santo André") + raioKm em vez de cidades/estados.
- Custos em créditos por lead/consulta: {CUSTOS}. enriquecimento_bigdatacorp cobra "bigdatacorp" por empresa consultada mais "socio_celular" por sócio consultado (achando ou não); com socios "todos" multiplica pelo número de sócios. Use em parte do lote (ramo) quando o usuário se preocupar com custo. enriquecimento_ia usa a chave OpenAI do próprio usuário (sem crédito).

Recursos que a conta já tem (use os ids exatos; se faltar algum, deixe o id como null e diga em oQueFalta o que criar):
{RECURSOS}

Módulos disponíveis:
{TIPOS}

Formato da resposta:
- nos: cada um com "ref" curto e único (ex.: "gatilho", "busca", "filtro_porte"), "tipo" e "configJson" (objeto JSON em texto, só com campos do schema do tipo).
- conexoes: "de"/"para" usam as refs; "saida" é "principal" ou o id da saída extra.
- nome: nome curto do fluxo.
- explicacao: em português simples, 3 a 6 frases, dizendo o que o fluxo faz e por quê. Sem travessão.
- oQueFalta: o que a pessoa ainda precisa fazer antes de ativar (ex.: criar a campanha de WhatsApp e escrever as mensagens, conectar o WhatsApp). Frases curtas.
Não invente módulos nem saídas. Prefira fluxos enxutos que façam exatamente o que foi pedido.`;

export function montarInstrucoes(profile: Profile, r: Recursos): string {
  const liberado = (t: FlowNodeTipo) => {
    const flag = FLAG_DO_TIPO[t];
    return !flag || profile.role === "admin" || Boolean(profile[flag]);
  };
  const tipos = FLOW_NODE_TYPES_LIST.filter((t) => t.disponivel).map((t) => descreverTipo(t, liberado(t.tipo))).join("\n");
  const recursos = JSON.stringify({
    campanhasWhatsapp: r.campanhasWhatsapp,
    campanhasEmail: r.campanhasEmail,
    remetentesEmail: r.remetentesEmail,
    campanhasLinkedin: r.campanhasLinkedin,
    contasLinkedin: r.contasLinkedin,
    funis: r.funis,
    planilhasGoogleSheets: r.planilhas,
  });
  return INSTRUCOES.replace("{CUSTOS}", JSON.stringify(r.custos)).replace("{RECURSOS}", recursos).replace("{TIPOS}", tipos);
}

// ── Saneamento ───────────────────────────────────────────────────────

const CNAE_CODIGOS = new Set(CNAES.map((c) => c.codigo));

function sanearConfig(tipo: FlowNodeTipo, bruto: Record<string, unknown>, r: Recursos, faltas: string[]): Record<string, unknown> {
  const c: Record<string, unknown> = { ...bruto };
  const idDe = (valor: unknown, lista: { id: string }[]) => (typeof valor === "string" && lista.some((x) => x.id === valor) ? valor : null);

  if (tipo === "extracao_cnpj") {
    const codigos = [
      ...(Array.isArray(c.cnaes) ? c.cnaes : []),
      ...String(c.cnaeManual ?? "").split(","),
    ].map((x) => String(x).replace(/\D/g, "")).filter((x) => x.length === 7);
    c.cnaes = Array.from(new Set(codigos.filter((x) => CNAE_CODIGOS.has(x))));
    c.cnaeManual = Array.from(new Set(codigos.filter((x) => !CNAE_CODIGOS.has(x)))).join(", ");
    if (Array.isArray(c.uf)) c.uf = c.uf.map((u) => String(u).toUpperCase().slice(0, 2));
  }
  if (tipo === "disparo_whatsapp") c.campaignId = idDe(c.campaignId, r.campanhasWhatsapp);
  if (tipo === "disparo_email") {
    c.campaignId = idDe(c.campaignId, r.campanhasEmail);
    c.senderId = idDe(c.senderId, r.remetentesEmail);
  }
  if (tipo === "disparo_linkedin") {
    c.campaignId = idDe(c.campaignId, r.campanhasLinkedin);
    c.accountId = idDe(c.accountId, r.contasLinkedin);
  }
  if (tipo.startsWith("disparo_") && !c.campaignId) {
    faltas.push(`Escolher a campanha no módulo ${FLOW_NODE_TYPES[tipo].label} (crie a campanha antes, se ainda não existir).`);
  }
  if (tipo === "destino_funil") {
    const funil = r.funis.find((f) => f.id === c.funilId);
    c.funilId = funil?.id ?? null;
    c.colunaId = funil?.colunas.some((col) => col.id === c.colunaId) ? c.colunaId : null;
    if (!c.colunaId) faltas.push("Escolher o funil e a coluna no módulo Adicionar ao Funil.");
  }
  if (tipo === "destino_sheets" || tipo === "gatilho_planilha") {
    if (!r.planilhas.some((p) => p.id === c.sheetId)) {
      c.sheetId = "";
      faltas.push(`Escolher a planilha no módulo ${FLOW_NODE_TYPES[tipo].label}.`);
    }
  }

  // Com os padrões do tipo aplicados quando a config fecha; senão fica como
  // veio e o construtor mostra a pendência no cartão.
  const parsed = FLOW_NODE_TYPES[tipo].configSchema.safeParse(c);
  return parsed.success ? (parsed.data as Record<string, unknown>) : c;
}

function criaCiclo(edges: FlowEdge[], de: string, para: string): boolean {
  const pilha = [para];
  const vistos = new Set<string>();
  while (pilha.length) {
    const atual = pilha.pop()!;
    if (atual === de) return true;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    for (const e of edges) if (e.from === atual) pilha.push(e.to);
  }
  return false;
}

export interface FluxoGerado {
  nome: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  explicacao: string;
  oQueFalta: string[];
}

export async function gerarFluxoComIa(sb: SupabaseClient, profile: Profile, descricao: string): Promise<FluxoGerado> {
  const recursos = await carregarRecursos(sb, profile.id, profile);
  const ia = await clienteIa();
  const resposta = await chamar(ia, montarInstrucoes(profile, recursos), descricao, respostaSchema, "fluxo_leadmatic");
  return montarFluxoDaResposta(resposta, recursos);
}

/** Transforma a proposta da IA num fluxo válido (sem chamada externa; testável). */
export function montarFluxoDaResposta(resposta: RespostaIa, recursos: Recursos): FluxoGerado {
  const faltas: string[] = [];
  const idPorRef = new Map<string, string>();
  let nodes: FlowNode[] = [];
  for (const no of resposta.nos) {
    if (idPorRef.has(no.ref) || !(no.tipo in FLOW_NODE_TYPES)) continue;
    let bruto: Record<string, unknown> = {};
    try {
      const v = JSON.parse(no.configJson);
      if (v && typeof v === "object" && !Array.isArray(v)) bruto = v;
    } catch {
      bruto = {};
    }
    const id = crypto.randomUUID();
    idPorRef.set(no.ref, id);
    nodes.push({ id, tipo: no.tipo, config: sanearConfig(no.tipo, bruto, recursos, faltas) as Json, posicao: { x: 0, y: 0 } });
  }
  if (!nodes.length) throw new Error("A IA não conseguiu montar um fluxo com essa descrição. Tente detalhar um pouco mais.");

  const tipoPorId = new Map(nodes.map((n) => [n.id, n.tipo]));
  let edges: FlowEdge[] = [];
  for (const c of resposta.conexoes) {
    const from = idPorRef.get(c.de);
    const to = idPorRef.get(c.para);
    const saida = c.saida === "principal" ? "" : c.saida;
    if (!from || !to || from === to) continue;
    if (!saidasValidas(tipoPorId.get(from)!).includes(saida)) continue;
    if (edges.some((e) => e.from === from && (e.saida || "") === saida)) continue;
    if (FLOW_NODE_TYPES[tipoPorId.get(to)!].categoria === "gatilho") continue;
    if (criaCiclo(edges, from, to)) continue;
    edges.push({ id: crypto.randomUUID(), from, to, ...(saida ? { saida } : {}) });
  }

  // Exatamente um gatilho: sobra vira fora, falta vira um manual na frente.
  const gatilhos = nodes.filter((n) => FLOW_NODE_TYPES[n.tipo].categoria === "gatilho");
  for (const extra of gatilhos.slice(1)) {
    nodes = nodes.filter((n) => n.id !== extra.id);
    edges = edges.filter((e) => e.from !== extra.id && e.to !== extra.id);
  }
  if (!gatilhos.length) {
    const id = crypto.randomUUID();
    const primeiro = nodes.find((n) => !edges.some((e) => e.to === n.id));
    nodes.unshift({ id, tipo: "gatilho_manual", config: { variaveis: [] }, posicao: { x: 0, y: 0 } });
    if (primeiro) edges.push({ id: crypto.randomUUID(), from: id, to: primeiro.id });
  }

  // Módulo que a IA deixou solto (fora do caminho do gatilho) nunca roda: sai.
  const alcancados = new Set<string>([nodes.find((n) => FLOW_NODE_TYPES[n.tipo].categoria === "gatilho")!.id]);
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const e of edges) {
      if (alcancados.has(e.from) && !alcancados.has(e.to)) {
        alcancados.add(e.to);
        mudou = true;
      }
    }
  }
  nodes = nodes.filter((n) => alcancados.has(n.id));
  edges = edges.filter((e) => alcancados.has(e.from) && alcancados.has(e.to));

  const estrutura = validarEstruturaFluxo(nodes, edges);
  if (!estrutura.ok) throw new Error(`O fluxo gerado veio com um problema (${estrutura.erro}). Tente de novo.`);

  const pos = posicoesEmArvore(nodes, edges, (id) => alturaEstimada(tipoPorId.get(id) ?? "gatilho_manual"));
  nodes = nodes.map((n) => ({ ...n, posicao: pos.get(n.id) ?? n.posicao }));

  const oQueFalta = Array.from(new Set([...resposta.oQueFalta.map((f) => limparTracos(f.trim())).filter(Boolean), ...faltas])).slice(0, 8);
  return {
    nome: limparTracos(resposta.nome.trim()).slice(0, 80) || "Fluxo criado com IA",
    nodes,
    edges,
    explicacao: limparTracos(resposta.explicacao.trim()),
    oQueFalta,
  };
}
