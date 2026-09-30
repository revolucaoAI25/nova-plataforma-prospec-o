import { FLOW_NODE_TYPES, validarConfigDoNo } from "./node-types";
import type { FlowNodeTipo } from "@/lib/database.types";

// Textos curtos pro construtor de fluxos: o que cada nó vai fazer (mostrado
// no próprio cartão, sem precisar abrir o painel) e o que ainda falta pro
// fluxo poder rodar. Só leitura da config — nada aqui vai ao banco.

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type Cfg = Record<string, unknown>;

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : []);
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function juntar(partes: (string | number | null | false | undefined)[]): string | null {
  const validas = partes.filter((p): p is string => typeof p === "string" && p.length > 0);
  return validas.length ? validas.join(" · ") : null;
}

function resumirLista(itens: string[], singular: string, plural: string, mostrar = 2): string | null {
  if (!itens.length) return null;
  if (itens.length <= mostrar) return itens.join(", ");
  return `${itens.length} ${itens.length === 1 ? singular : plural}`;
}

function diasSemana(v: unknown): string | null {
  const dias = Array.isArray(v) ? v.filter((d): d is number => typeof d === "number") : [];
  if (!dias.length) return null;
  const ordenados = [...dias].sort((a, b) => a - b);
  if (ordenados.join() === "1,2,3,4,5") return "dias úteis";
  if (ordenados.length === 7) return "todo dia";
  return ordenados.map((d) => DIAS[d]).join(", ");
}

/** Uma linha dizendo o que o nó faz com a config atual (null se não há nada a dizer). */
export function resumoDoNo(tipo: FlowNodeTipo, config: unknown): string | null {
  // Com os defaults do schema aplicados — um nó recém-criado já mostra o
  // que vai fazer (ex.: "Esperar" nasce com 60 min).
  const parsed = FLOW_NODE_TYPES[tipo]?.configSchema.safeParse(config);
  const base = parsed?.success ? parsed.data : config;
  const c = (base && typeof base === "object" ? base : {}) as Cfg;
  switch (tipo) {
    case "gatilho_agendado":
      return juntar([diasSemana(c.diasSemana), texto(c.horario) && `às ${texto(c.horario)}`]);
    case "gatilho_manual": {
      const vars = Array.isArray(c.variaveis) ? c.variaveis.length : 0;
      return vars ? `${vars} variáve${vars === 1 ? "l" : "is"} de entrada` : "Você clica em Executar agora";
    }
    case "gatilho_filtro_leads":
      return juntar([texto(c.nicho), texto(c.subnicho), texto(c.uf)]) ?? "Qualquer lead novo";
    case "gatilho_planilha":
      return texto(c.abaNome) ? `Aba "${texto(c.abaNome)}"` : null;
    case "extracao_cnpj": {
      const cnaes = lista(c.cnaes);
      return juntar([
        c.recuperacaoJudicial ? "Recuperação judicial" : resumirLista(cnaes, "CNAE", "CNAEs"),
        resumirLista(lista(c.uf), "estado", "estados", 3),
        num(c.aberturaUltimosDias) && `abertas há ≤ ${num(c.aberturaUltimosDias)} dias`,
        num(c.limite) && `até ${num(c.limite)}`,
      ]);
    }
    case "extracao_maps":
      return juntar([
        texto(c.queryCustom) || texto(c.nicho),
        resumirLista(lista(c.cidades), "cidade", "cidades") ?? resumirLista(lista(c.estados), "estado", "estados", 3),
        num(c.limite) && `até ${num(c.limite)}`,
      ]);
    case "extracao_instagram":
      return juntar([texto(c.termoBusca) && `@${texto(c.termoBusca).replace(/^@/, "")}`, c.tipo === "seguindo" ? "seguindo" : "seguidores", num(c.limite) && `até ${num(c.limite)}`]);
    case "extracao_linkedin":
      return juntar([resumirLista(lista(c.cargos), "cargo", "cargos"), resumirLista(lista(c.localizacoes), "local", "locais"), num(c.limite) && `até ${num(c.limite)}`]);
    case "fonte_historico":
      return texto(c.searchId) ? "Pesquisa escolhida" : null;
    case "enriquecimento_ia": {
      const extras = [c.buscarSocios && "sócios", c.buscarFundacao && "fundação", c.buscarProcessos && "processos"].filter(Boolean) as string[];
      const campos = lista(c.camposCustomizados).length;
      return juntar([extras.join(", ") || null, campos && `${campos} campo${campos > 1 ? "s" : ""} próprio${campos > 1 ? "s" : ""}`]) ?? "Pesquisa geral da empresa";
    }
    case "enriquecimento_maps":
      return c.filtrar ? `Só quem está no Maps${num(c.minAvaliacoes) ? ` com ${num(c.minAvaliacoes)}+ avaliações` : ""}` : "Completa telefone, site e avaliação";
    case "enriquecimento_bigdatacorp":
      return "Sócio, telefone e e-mail pelo CNPJ";
    case "filtro_leads":
      return texto(c.campo) ? `${texto(c.campo)} ${String(c.operador ?? "").replace("_", " ")}${texto(c.valor) ? ` "${texto(c.valor)}"` : ""}` : null;
    case "espera": {
      const m = num(c.minutos);
      if (!m) return null;
      if (m % 1440 === 0) return `${m / 1440} dia${m / 1440 > 1 ? "s" : ""}`;
      if (m % 60 === 0) return `${m / 60} h`;
      return `${m} min`;
    }
    case "disparo_whatsapp":
    case "disparo_email":
    case "disparo_linkedin":
      return texto(c.campaignId) ? "Campanha escolhida" : "Escolha a campanha";
    case "destino_sheets":
      return juntar([texto(c.aba) && `Aba "${texto(c.aba)}"`, c.modo === "substituir" ? "substitui" : "acrescenta"]);
    case "destino_funil":
      return texto(c.colunaId) ? "Coluna escolhida" : null;
    default:
      return null;
  }
}

/** Primeiro problema da config do nó, em português, ou null se está pronta. */
export function problemaDoNo(tipo: FlowNodeTipo, config: unknown): string | null {
  const r = validarConfigDoNo(tipo, config);
  if (r.success) return null;
  const issue = r.error.issues[0];
  // Mensagens padrão do zod ("Invalid input", "Too small"…) não dizem nada
  // pro usuário: nesses casos cai num texto genérico.
  const msg = issue?.message ?? "";
  return /^(Invalid|Too small|Required|Expected)/i.test(msg) || !msg ? "Falta preencher a configuração." : msg;
}

export interface PendenciaFluxo {
  nodeId: string | null;
  mensagem: string;
}

interface NoMinimo { id: string; tipo: FlowNodeTipo; config: unknown }
interface ArestaMinima { from: string; to: string }

/**
 * O que impede o fluxo de rodar como o usuário espera: gatilho ausente ou
 * repetido, nó sem configuração válida e nó solto (fora do caminho que sai
 * do gatilho — o motor nunca chega nele).
 */
export function pendenciasDoFluxo(nodes: NoMinimo[], edges: ArestaMinima[]): PendenciaFluxo[] {
  const pendencias: PendenciaFluxo[] = [];
  const gatilhos = nodes.filter((n) => FLOW_NODE_TYPES[n.tipo]?.categoria === "gatilho");
  if (!gatilhos.length) pendencias.push({ nodeId: null, mensagem: "Adicione um gatilho (o que dispara o fluxo)." });
  if (gatilhos.length > 1) {
    for (const g of gatilhos.slice(1)) pendencias.push({ nodeId: g.id, mensagem: "Só pode haver um gatilho por fluxo — remova este." });
  }

  for (const n of nodes) {
    const problema = problemaDoNo(n.tipo, n.config);
    if (problema) pendencias.push({ nodeId: n.id, mensagem: `${FLOW_NODE_TYPES[n.tipo].label}: ${problema}` });
  }

  if (gatilhos.length === 1) {
    const proximo = new Map(edges.map((e) => [e.from, e.to]));
    const alcancados = new Set<string>([gatilhos[0].id]);
    let atual = proximo.get(gatilhos[0].id);
    while (atual && !alcancados.has(atual)) {
      alcancados.add(atual);
      atual = proximo.get(atual);
    }
    if (nodes.length > 1 && alcancados.size === 1) {
      pendencias.push({ nodeId: gatilhos[0].id, mensagem: "Conecte o gatilho ao próximo passo (arraste da bolinha à direita)." });
    }
    for (const n of nodes) {
      if (!alcancados.has(n.id) && FLOW_NODE_TYPES[n.tipo]?.categoria !== "gatilho") {
        pendencias.push({ nodeId: n.id, mensagem: `${FLOW_NODE_TYPES[n.tipo].label}: não está ligado ao caminho do gatilho — nunca vai rodar.` });
      }
    }
  }
  return pendencias;
}
