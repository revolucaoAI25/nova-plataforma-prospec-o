import { emptyLead, type Lead } from "@/lib/types";

// Extração de leads via LinkedIn (busca por pessoas/decisores, estilo Sales
// Navigator) — integração com Apify, mesmo padrão de instagram.ts.
//
// Schema verificado direto no Apify Console (aba Input/API do ator
// harvestapi/linkedin-profile-search) — a primeira versão deste arquivo tinha
// sido escrita com o input adivinhado via busca (`maxResults`, que não
// existe; o campo real é `maxItems`) e um normalizador defensivo de saída.
// Corrigido com o schema real:
// - Input: maxItems (não maxResults), currentJobTitles, locations,
//   searchQuery, takePages (nº de páginas de busca, 25 perfis cada),
//   profileScraperMode ("Short" | "Full" | "Full + email search" — default
//   "Full", que já traz experience/currentPosition/about; "Short" só traz
//   dado básico da página de busca). Custo: ~$100/1000 páginas de busca +
//   $4/1000 perfis completos (ou $10/1000 com busca de e-mail) — por isso
//   "Full + email search" fica atrás de um toggle explícito no formulário
//   (buscarEmail), não é o padrão (2.5x mais caro e a busca de e-mail não
//   é garantida). industryIds (filtro "Tipo de empresa" no formulário) usa
//   os IDs reais de indústria do LinkedIn — lista completa (433 setores)
//   baixada de github.com/HarvestAPI/linkedin-industry-codes-v2 e gerada em
//   src/lib/data/linkedin-industries.ts.
// - Output: perfil tem `linkedinUrl`, `firstName`/`lastName` (não um único
//   campo "name"), `headline` (tagline livre do perfil, não é o cargo),
//   `about` (bio), `location.parsed.text`/`location.linkedinText`,
//   `currentPosition[0].companyName` (empresa atual) e `experience[]` (cada
//   item com `position` = cargo, `companyName`, `endDate.text === "Present"`
//   pro emprego atual — usamos isso pra achar o cargo atual, já que
//   currentPosition não tem campo de cargo). Não há campo de "senioridade"
//   na saída (só existe como filtro de busca, seniorityLevelIds) — o campo
//   fica vazio por enquanto. O nome exato do campo de e-mail (modo "Full +
//   email search") não foi confirmado — mantido defensivo.

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_PEOPLE_SEARCH = "harvestapi~linkedin-profile-search";
const RUN_TIMEOUT_MS = 420_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function iniciarRun(apiKey: string, actorId: string, inputData: Record<string, unknown>) {
  const resp = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inputData),
  });
  if (!resp.ok) {
    let detalhe = "";
    try {
      const j = await resp.json();
      detalhe = j?.error?.message || JSON.stringify(j).slice(0, 300);
    } catch {
      detalhe = (await resp.text()).slice(0, 300);
    }
    throw new Error(`Apify ${resp.status}: ${detalhe}`);
  }
  const data = (await resp.json()).data;
  return { runId: data.id as string, datasetId: data.defaultDatasetId as string };
}

async function aguardarRun(apiKey: string, runId: string, onProgress?: (a: number, t: number, msg: string) => void) {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  let tentativa = 0;
  while (Date.now() < deadline) {
    await sleep(Math.min(8000 + tentativa * 2000, 20000));
    tentativa += 1;
    const resp = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(apiKey)}`);
    if (!resp.ok) throw new Error(`Apify HTTP ${resp.status} consultando o run.`);
    const status = (await resp.json()).data.status as string;
    onProgress?.(0, 1, `Apify: ${status.toLowerCase()}… (${tentativa * 10}s)`);
    if (status === "SUCCEEDED") return;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      throw new Error(`Apify encerrou com status: ${status}`);
    }
  }
  throw new Error(`Apify não respondeu em ${RUN_TIMEOUT_MS / 1000}s. Tente com menos resultados.`);
}

async function obterItems(apiKey: string, datasetId: string, limite: number): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ token: apiKey, format: "json", limit: String(limite) });
  const resp = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?${params}`);
  if (!resp.ok) throw new Error(`Apify HTTP ${resp.status} baixando resultados.`);
  return (await resp.json()) || [];
}

/** Remove query string/trailing slash e força https — chave de dedup estável entre buscas. */
function normalizarUrlPerfil(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    u.protocol = "https:";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

interface LinkedInExperience {
  position?: string;
  companyName?: string;
  endDate?: { text?: string };
}

function normalizarPerfil(item: Record<string, unknown>): Lead | null {
  const linkedinUrl = normalizarUrlPerfil(String(item.linkedinUrl ?? "").trim());

  const firstName = String(item.firstName ?? "").trim();
  const lastName = String(item.lastName ?? "").trim();
  const nome = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!nome && !linkedinUrl) return null;

  const experiencias = Array.isArray(item.experience) ? (item.experience as LinkedInExperience[]) : [];
  // currentPosition não traz o cargo (só empresa/período) — o cargo atual
  // vem de experience[], preferindo a entrada com endDate.text "Present".
  const experienciaAtual = experiencias.find((e) => e?.endDate?.text === "Present") ?? experiencias[0];

  const currentPosition = Array.isArray(item.currentPosition)
    ? (item.currentPosition[0] as Record<string, unknown> | undefined)
    : undefined;

  const location = item.location as { linkedinText?: string; parsed?: { text?: string } } | undefined;

  const lead = emptyLead();
  lead.linkedin_url = linkedinUrl;
  lead.nome = nome || linkedinUrl;
  lead.nome_completo = nome;
  lead.cargo = String(experienciaAtual?.position ?? item.headline ?? "").trim();
  lead.empresa_atual = String(
    currentPosition?.companyName ?? experienciaAtual?.companyName ?? "",
  ).trim();
  lead.municipio = String(location?.parsed?.text ?? location?.linkedinText ?? "").trim();
  // Nome do campo de e-mail (modo "Full + email search") não confirmado — defensivo.
  lead.email = String(item.email ?? item.emailAddress ?? "").trim();
  lead.bio = String(item.about ?? "").trim().slice(0, 500);
  lead.nicho_busca = "LinkedIn";
  lead.fonte = "linkedin";
  return lead;
}

export interface BuscarLinkedInParams {
  apifyApiKey: string;
  cargos: string[];
  localizacoes: string[];
  industrias?: string[];
  palavraChave?: string;
  buscarEmail?: boolean;
  limite?: number;
  onProgress?: (a: number, t: number, msg: string) => void;
  excludeUrls?: Set<string>;
}

export async function buscarLinkedIn(p: BuscarLinkedInParams): Promise<Lead[]> {
  if (!p.apifyApiKey) {
    throw new Error("Chave Apify não configurada. Acesse Configurações → Instagram (a mesma chave vale para LinkedIn).");
  }
  if (!p.cargos.length && !p.localizacoes.length && !p.industrias?.length && !p.palavraChave?.trim()) {
    throw new Error("Informe ao menos um cargo, localização, tipo de empresa ou palavra-chave.");
  }

  const limite = p.limite ?? 100;
  const cb = p.onProgress ?? (() => {});

  cb(0, 1, "Preparando extração…");

  // takePages garante páginas suficientes pra alcançar maxItems (25 perfis
  // por página) — sem isso, o ator pode parar cedo demais. Teto de 100
  // páginas é o próprio limite do ator (imposto pelo LinkedIn).
  const inputData: Record<string, unknown> = {
    maxItems: limite,
    takePages: Math.min(100, Math.max(1, Math.ceil(limite / 25))),
    profileScraperMode: p.buscarEmail ? "Full + email search" : "Full",
  };
  if (p.cargos.length) inputData.currentJobTitles = p.cargos;
  if (p.localizacoes.length) inputData.locations = p.localizacoes;
  if (p.industrias?.length) inputData.industryIds = p.industrias;
  if (p.palavraChave?.trim()) inputData.searchQuery = p.palavraChave.trim();

  cb(0, 1, "Iniciando job no Apify…");
  const { runId, datasetId } = await iniciarRun(p.apifyApiKey, ACTOR_PEOPLE_SEARCH, inputData);
  await aguardarRun(p.apifyApiKey, runId, p.onProgress);

  cb(0, 1, "Baixando resultados…");
  const rawItems = await obterItems(p.apifyApiKey, datasetId, limite * 2);

  if (!rawItems.length) {
    throw new Error("O Apify retornou 0 itens. Tente cargos/localizações mais amplos.");
  }

  const vistos = new Set(p.excludeUrls ?? []);
  let ignorados = 0;
  const resultados: Lead[] = [];

  for (const item of rawItems) {
    if (resultados.length >= limite) break;
    const lead = normalizarPerfil(item);
    if (!lead) continue;
    const dedupKey = lead.linkedin_url || lead.nome;
    if (dedupKey && vistos.has(dedupKey)) {
      ignorados += 1;
      continue;
    }
    if (dedupKey) vistos.add(dedupKey);
    resultados.push(lead);
  }

  if (rawItems.length && !resultados.length) {
    const first = rawItems[0];
    if ("message" in first && Object.keys(first).length <= 3) {
      throw new Error(`O actor retornou um erro: ${first.message}`);
    }
    throw new Error(`Apify retornou ${rawItems.length} itens mas nenhum pôde ser normalizado — o schema do ator pode ter mudado (ver comentário no topo deste arquivo).`);
  }

  cb(1, 1, ignorados ? `${resultados.length} novos leads (${ignorados} duplicatas ignoradas)` : `${resultados.length} leads extraídos`);
  return resultados;
}
