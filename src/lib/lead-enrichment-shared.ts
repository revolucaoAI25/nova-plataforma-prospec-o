import type { NivelRaciocinio } from "@/lib/database.types";

// Parte do enriquecimento de leads que NÃO depende do SDK da OpenAI —
// separado de src/lib/integrations/lead-enrichment.ts especificamente pra
// poder ser importado em componentes client ("use client") sem levar o
// pacote `openai` (server-only) pro bundle do navegador. Ver esse outro
// arquivo para o restante (chamada à IA em si).

export function apenasDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export function normalizarSimNao(valor: unknown): string | null {
  let v = String(valor ?? "").trim().toLowerCase();
  v = v.replace(/ã/g, "a").replace(/á/g, "a").replace(/ç/g, "c");
  if (["sim", "yes", "true"].includes(v)) return "sim";
  if (["nao", "no", "false"].includes(v)) return "nao";
  if (["nao_encontrado", "nao encontrado", "nao_verificado", "nao verificado", "unknown", "indeterminado"].includes(v)) {
    return "nao_encontrado";
  }
  return null;
}

// DDD → UF, usado só como PISTA regional pra ajudar a busca e, principalmente,
// como checagem cruzada contra o que a IA encontrar — reduz falso positivo
// tipo "achei uma empresa em outro estado que não tem nada a ver, só porque
// o nome bateu".
const DDD_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF", "62": "GO", "64": "GO",
  "63": "TO",
  "65": "MT", "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE",
  "81": "PE", "87": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE", "88": "CE",
  "86": "PI", "89": "PI",
  "91": "PA", "93": "PA", "94": "PA",
  "92": "AM", "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA", "99": "MA",
};

/** Estima a UF a partir do DDD de um telefone brasileiro. null se não der pra reconhecer. */
export function ufProvavelPorTelefone(telefone: string): string | null {
  let digitos = apenasDigitos(telefone);
  if (digitos.startsWith("55") && digitos.length > 10) digitos = digitos.slice(2);
  if (digitos.length < 10) return null;
  return DDD_UF[digitos.slice(0, 2)] ?? null;
}

// ── Texto colado com vários leads — parser tolerante a formato ─────────────

const BULLET = "[*\\-•●○▪–—]?";
const CAMPO_PATTERNS: Array<[string, RegExp]> = [
  ["email", new RegExp(`^${BULLET}\\s*e[-\\s]?mail\\s*[:\\-]?\\s*(.*)$`, "i")],
  ["nome", new RegExp(`^${BULLET}\\s*(?:full\\s*name|nome\\s*completo|nome)\\s*[:\\-]?\\s*(.*)$`, "i")],
  ["telefone", new RegExp(`^${BULLET}\\s*(?:phone\\s*number|phone|telefone|celular|whatsapp)\\s*[:\\-]?\\s*(.*)$`, "i")],
];

function linhaERotulo(linha: string): boolean {
  return CAMPO_PATTERNS.some(([, patt]) => patt.test(linha));
}

function dividirEmBlocos(texto: string): string[] {
  texto = (texto || "").trim();
  if (!texto) return [];
  const emailPatt = CAMPO_PATTERNS[0][1];
  const blocos: string[] = [];
  for (const bruto of texto.split(/\n\s*\n/)) {
    const linhas = bruto.split("\n");
    const inicios = linhas.reduce<number[]>((acc, l, i) => {
      if (emailPatt.test(l.trim())) acc.push(i);
      return acc;
    }, []);
    if (inicios.length <= 1) {
      blocos.push(bruto);
      continue;
    }
    const limites = [...inicios, linhas.length];
    for (let i = 0; i < limites.length - 1; i++) {
      blocos.push(linhas.slice(limites[i], limites[i + 1]).join("\n"));
    }
  }
  return blocos;
}

export interface LeadColado {
  nome: string;
  email: string;
  telefone: string;
}

/** Fallback simples: uma linha "Nome, Email, Telefone" (vírgula, ponto e
 * vírgula ou tab), sem rótulos — pra quem cola direto de uma planilha sem
 * os marcadores "* Rótulo". */
function linhaECsv(linha: string): LeadColado | null {
  const partes = linha.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2) return null;
  const lead: LeadColado = { nome: "", email: "", telefone: "" };
  for (const p of partes) {
    if (p.includes("@") && !lead.email) {
      lead.email = p;
    } else if (/\d{8,}/.test(apenasDigitos(p)) && !lead.telefone) {
      lead.telefone = p;
    } else if (!lead.nome) {
      lead.nome = p;
    }
  }
  return lead.email || lead.telefone ? lead : null;
}

/**
 * Faz o parse de um texto colado com vários leads. Aceita dois formatos,
 * tentados nessa ordem: (1) bloco por lead, rótulo + valor; (2) uma linha
 * por lead, campos separados por vírgula/ponto e vírgula/tab (sem rótulos).
 * Leads sem e-mail e sem telefone (nada pra buscar) são descartados.
 */
export function parseLeadsColados(texto: string): LeadColado[] {
  const leads: LeadColado[] = [];
  for (const bloco of dividirEmBlocos(texto)) {
    const linhas = bloco.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!linhas.length) continue;
    if (linhaERotulo(linhas[0])) {
      const lead: LeadColado = { nome: "", email: "", telefone: "" };
      let i = 0;
      while (i < linhas.length) {
        const linha = linhas[i];
        for (const [campo, patt] of CAMPO_PATTERNS) {
          const m = linha.match(patt);
          if (!m) continue;
          let valor = (m[1] ?? "").trim();
          if (!valor && i + 1 < linhas.length && !linhaERotulo(linhas[i + 1])) {
            valor = linhas[i + 1];
            i += 1;
          }
          (lead as unknown as Record<string, string>)[campo] = valor;
          break;
        }
        i += 1;
      }
      if (lead.email || lead.telefone) leads.push(lead);
    } else {
      for (const linha of linhas) {
        const lead = linhaECsv(linha);
        if (lead) leads.push(lead);
      }
    }
  }
  return leads;
}

// ── Nível de raciocínio — configurável por quem usa ─────────────────────

export const NIVEIS_RACIOCINIO: Record<
  NivelRaciocinio,
  { label: string; descricao: string; reasoningEffort: "low" | "medium" | "high"; verbosity: "low" | "medium" | "high"; maxToolCalls: number }
> = {
  rapido: {
    label: "Rápido e econômico",
    descricao:
      "Busca mais direta, menos aprofundada. Mais barato e mais rápido, mas em casos mais difíceis (pouca informação " +
      'disponível) pode não achar o que buscaria com mais tempo — em testes reais, esse nível deixou passar alguns casos ' +
      'que o "equilibrado" achava.',
    reasoningEffort: "low", verbosity: "low", maxToolCalls: 6,
  },
  equilibrado: {
    label: "Equilibrado (recomendado)",
    descricao: "Bom equilíbrio entre profundidade de busca e custo — é o nível já calibrado e testado com casos reais.",
    reasoningEffort: "medium", verbosity: "low", maxToolCalls: 9,
  },
  profundo: {
    label: "Mais profundo e detalhado",
    descricao: "Pesquisa mais a fundo, com mais tentativas, e escreve resumos mais completos — mais lento e mais caro por lead.",
    reasoningEffort: "high", verbosity: "medium", maxToolCalls: 12,
  },
};
export const NIVEL_PADRAO: NivelRaciocinio = "equilibrado";
