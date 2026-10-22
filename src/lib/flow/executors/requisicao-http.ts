import { variaveisDerivadas } from "@/lib/mensagem";
import { conferirUrl, requisicaoSegura, ErroHttpSeguro } from "@/lib/http-seguro";
import type { FlowExecutorContext, FlowExecutorOutcome } from "../executor-types";

/**
 * Requisição HTTP: manda os leads para outro sistema (webhook, CRM, outra
 * plataforma de disparo). Por lead (uma chamada para cada um) ou em lotes
 * (uma chamada com vários leads). Quem deu certo (resposta 2xx) segue pela
 * saída principal; quem falhou sai por "Falhou", se ligada.
 *
 * Campos do lead entram com {{campo}} (ou {{lead.campo}}) na URL, nos
 * cabeçalhos e no corpo, e {{variaveis.x}} traz os parâmetros do gatilho
 * manual. O valor é escapado conforme o lugar: na URL vira texto de URL,
 * num corpo JSON vira texto de JSON (aspas e quebras de linha não quebram
 * o JSON), num formulário vira texto de formulário. O motor não interpola
 * a config deste nó antes (src/lib/flow/flow-engine.ts): aqui cada lead
 * usa os próprios dados, não os do primeiro do lote.
 */

const MAX_LEADS_POR_LEAD = 1000;
const PARALELO = 8;
const TIMEOUT_MS = 10_000;
const RESPOSTA_GUARDADA = 1000;
// Falhas de rede seguidas, sem nenhum sucesso, antes de desistir do resto do lote.
const DESISTIR_APOS = 10;
const METODOS_SEM_CORPO = new Set(["GET", "DELETE"]);
const CABECALHOS_PROIBIDOS = new Set(["content-length", "transfer-encoding", "connection", "host", "upgrade", "te", "trailer", "keep-alive"]);

type Lead = Record<string, unknown>;
type Escape = "url" | "json" | "form" | "texto";

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)\s*(?:\|([^}]*))?\}\}/g;

function comoTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function escapar(valor: string, modo: Escape): string {
  if (modo === "url" || modo === "form") return encodeURIComponent(valor);
  if (modo === "json") return JSON.stringify(valor).slice(1, -1);
  return valor;
}

/**
 * Troca os {{tokens}}. `{{leads}}` (só no modo lote) vira o JSON do lote,
 * sem escape: é para ser colocado como valor, ex. {"contatos": {{leads}}}.
 */
export function interpolarHttp(
  modelo: string,
  dados: { lead: Lead | null; variaveis: Record<string, string>; lote?: Lead[] },
  modo: Escape,
): string {
  if (!modelo.includes("{{")) return modelo;
  const derivadas = dados.lead ? variaveisDerivadas(dados.lead) : {};
  return modelo.replace(TOKEN, (_m, caminho: string, padrao?: string) => {
    if (caminho === "leads" && dados.lote) return JSON.stringify(dados.lote);
    let valor = "";
    if (caminho.startsWith("variaveis.")) {
      valor = dados.variaveis[caminho.slice(10)] ?? "";
    } else if (dados.lead) {
      const campo = caminho.startsWith("lead.") ? caminho.slice(5) : caminho;
      valor = comoTexto(dados.lead[campo]) || (derivadas as Record<string, string>)[campo] || "";
    }
    if (!valor.trim()) valor = (padrao ?? "").trim();
    return escapar(valor, modo);
  });
}

export function modoDoCorpo(cabecalhos: Record<string, string>): Escape {
  const tipo = Object.entries(cabecalhos).find(([k]) => k.toLowerCase() === "content-type")?.[1]?.toLowerCase() ?? "";
  if (tipo.includes("json")) return "json";
  if (tipo.includes("x-www-form-urlencoded")) return "form";
  return "texto";
}

interface Pedido {
  metodo: string;
  url: string;
  cabecalhos: Record<string, string>;
  corpo?: string;
}

type Resultado = { ok: true; status: number; resposta: string } | { ok: false; status: number | null; erro: string; rede: boolean };

async function enviar(p: Pedido): Promise<Resultado> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const r = await requisicaoSegura(p.url, { metodo: p.metodo, cabecalhos: p.cabecalhos, corpo: p.corpo, timeoutMs: TIMEOUT_MS });
      const resposta = r.corpo.slice(0, RESPOSTA_GUARDADA);
      if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status, resposta };
      // 429 e 5xx costumam passar numa segunda tentativa; 4xx não.
      if ((r.status === 429 || r.status >= 500) && tentativa === 0) {
        await new Promise((ok) => setTimeout(ok, 1500));
        continue;
      }
      return { ok: false, status: r.status, erro: `Resposta ${r.status}${resposta ? `: ${resposta.slice(0, 200)}` : ""}`, rede: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Endereço bloqueado ou URL inválida não muda numa segunda tentativa.
      if (e instanceof ErroHttpSeguro || tentativa === 1) return { ok: false, status: null, erro: msg, rede: true };
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  return { ok: false, status: null, erro: "Falha na requisição.", rede: true };
}

function montarCabecalhos(lista: unknown, dados: Parameters<typeof interpolarHttp>[1], temCorpo: boolean): Record<string, string> {
  const cab: Record<string, string> = { "User-Agent": "Leadmatic-Automacoes/1.0", Accept: "application/json, text/plain, */*" };
  for (const item of Array.isArray(lista) ? lista : []) {
    const nome = String((item as { nome?: unknown })?.nome ?? "").trim();
    if (!nome || CABECALHOS_PROIBIDOS.has(nome.toLowerCase()) || !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(nome)) continue;
    // Sem quebra de linha: não dá para injetar outro cabeçalho pelo valor.
    const valor = interpolarHttp(String((item as { valor?: unknown })?.valor ?? ""), dados, "texto").replace(/[\r\n]+/g, " ");
    for (const k of Object.keys(cab)) if (k.toLowerCase() === nome.toLowerCase()) delete cab[k];
    cab[nome] = valor;
  }
  if (temCorpo && !Object.keys(cab).some((k) => k.toLowerCase() === "content-type")) cab["Content-Type"] = "application/json";
  return cab;
}

export async function executarRequisicaoHttp(ctx: FlowExecutorContext): Promise<FlowExecutorOutcome> {
  const { node, contexto, saidasConectadas } = ctx;
  const config = (node.config || {}) as Record<string, unknown>;
  const metodo = String(config.metodo || "POST").toUpperCase();
  const urlModelo = String(config.url || "").trim();
  const modo = config.modo === "lote" ? "lote" : "por_lead";
  const tamanhoLote = Math.min(1000, Math.max(1, Number(config.tamanhoLote) || 100));
  const corpoModelo = String(config.corpo ?? "");
  const variaveis = (contexto.variaveis as Record<string, string>) || {};
  if (!urlModelo) return { status: "erro", erro: "Informe a URL da requisição." };

  const lote = contexto.lote || [];
  if (!lote.length) return { status: "concluido", leadsEntrada: 0, leadsSaida: 0, detalhe: { metodo, modo, enviados: 0 } };
  if (modo === "por_lead" && lote.length > MAX_LEADS_POR_LEAD) {
    return {
      status: "erro",
      erro: `Chegaram ${lote.length} leads; uma chamada por lead vai até ${MAX_LEADS_POR_LEAD}. Use o envio em lotes ou o módulo Limitar lote antes.`,
    };
  }

  const temCorpo = !METODOS_SEM_CORPO.has(metodo);
  // Cada grupo é uma chamada: um lead (por lead) ou um pedaço do lote.
  const grupos: Lead[][] = modo === "lote"
    ? Array.from({ length: Math.ceil(lote.length / tamanhoLote) }, (_, i) => lote.slice(i * tamanhoLote, (i + 1) * tamanhoLote))
    : lote.map((l) => [l]);

  const montarPedido = (grupo: Lead[]): Pedido | { erro: string } => {
    const dados = modo === "lote" ? { lead: null, variaveis, lote: grupo } : { lead: grupo[0], variaveis };
    const url = interpolarHttp(urlModelo, dados, "url");
    const conferida = conferirUrl(url);
    if (!conferida.ok) return { erro: conferida.erro };
    const cabecalhos = montarCabecalhos(config.cabecalhos, dados, temCorpo);
    let corpo: string | undefined;
    if (temCorpo) {
      corpo = corpoModelo.trim()
        ? interpolarHttp(corpoModelo, dados, modoDoCorpo(cabecalhos))
        : JSON.stringify(modo === "lote" ? { leads: grupo } : grupo[0]);
    }
    return { metodo, url, cabecalhos, corpo };
  };

  const deuCerto: Lead[] = [];
  const falhou: Lead[] = [];
  const erros = new Map<string, number>();
  let sucessos = 0;
  let falhasRedeSeguidas = 0;
  let desistiu = false;

  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < grupos.length) {
      const grupo = grupos[proximo++];
      let r: Resultado;
      if (desistiu) {
        r = { ok: false, status: null, erro: "Não enviado: o destino parou de responder.", rede: true };
      } else {
        const pedido = montarPedido(grupo);
        r = "erro" in pedido ? { ok: false, status: null, erro: pedido.erro, rede: false } : await enviar(pedido);
      }
      if (r.ok) {
        sucessos++;
        falhasRedeSeguidas = 0;
        for (const l of grupo) deuCerto.push({ ...l, http_status: r.status, http_resposta: r.resposta });
      } else {
        if (r.rede && !desistiu) falhasRedeSeguidas++;
        if (!sucessos && falhasRedeSeguidas >= DESISTIR_APOS) desistiu = true;
        erros.set(r.erro, (erros.get(r.erro) ?? 0) + grupo.length);
        for (const l of grupo) falhou.push({ ...l, http_status: r.status, http_erro: r.erro });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALELO, grupos.length) }, trabalhador));

  const principaisErros = [...erros.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([erro, leads]) => ({ erro, leads }));
  const detalhe = { metodo, modo, chamadas: grupos.length, deuCerto: deuCerto.length, falharam: falhou.length, erros: principaisErros };
  ctx.log(`requisição HTTP: ${deuCerto.length} ok, ${falhou.length} com falha`);

  const falhouLigada = saidasConectadas.includes("falhou");
  // Nada deu certo e ninguém trata a falha: mostra o erro no passo em vez de seguir com lote vazio.
  if (!deuCerto.length && !falhouLigada) {
    return { status: "erro", erro: `Nenhuma requisição deu certo. ${principaisErros[0]?.erro ?? ""}`.trim(), detalhe };
  }

  return {
    status: "concluido",
    leadsEntrada: lote.length,
    leadsSaida: deuCerto.length,
    detalhe,
    contextoPatch: { lote: deuCerto },
    saidas: falhouLigada ? { falhou } : undefined,
  };
}
