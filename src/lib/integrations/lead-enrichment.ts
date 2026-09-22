import OpenAI from "openai";
import type { EnrichmentLeadStatus } from "@/lib/database.types";
import { NIVEIS_RACIOCINIO, NIVEL_PADRAO, normalizarSimNao, ufProvavelPorTelefone } from "@/lib/lead-enrichment-shared";

// Enriquecimento de leads (nome/e-mail/telefone → dados comerciais da
// empresa) via IA com busca na web — portado de modules/lead_enrichment_ia.py
// (produto atual, branch claude/lawyer-prospect-database-5Bfil). O prompt e
// os critérios de confiança/corroboração abaixo são os MESMOS do original,
// calibrados com bastante iteração real — não foram reescritos aqui, só
// traduzidos de Python pra TypeScript.
//
// Este arquivo depende do SDK da OpenAI (server-only) — a parte pura (parse
// de texto colado, níveis de raciocínio) fica em
// src/lib/lead-enrichment-shared.ts pra poder ser importada em componentes
// client sem levar o pacote `openai` pro bundle do navegador.

export interface OpcoesEnriquecimento {
  nivelRaciocinio?: keyof typeof NIVEIS_RACIOCINIO;
  buscarSocios?: boolean;
  buscarFundacao?: boolean;
  buscarProcessos?: boolean;
  camposCustomizados?: string[];
}

interface DadosIa {
  empresa_nome?: string | null;
  cargo?: string | null;
  cnpj?: string | null;
  municipio?: string | null;
  uf?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  confianca?: string | null;
  fonte?: string | null;
  resumo?: string | null;
  socios?: string | null;
  fundacao?: string | null;
  processos_jusbrasil?: string | null;
  extras?: Record<string, string> | null;
}

/**
 * Pede pra um modelo OpenAI barato (gpt-5-mini) buscar na internet, cruzando
 * nome + e-mail (inclusive a parte antes do @) + telefone, e tentar
 * identificar a empresa/dados comerciais associados. Retorna null se não
 * achar nada com confiança razoável. Lança exceção se a chamada à IA falhar
 * tecnicamente após as 3 tentativas — distinto de "não encontrado".
 */
export async function enriquecerViaIa(
  nome: string,
  email: string,
  telefone: string,
  openaiApiKey: string,
  opcoes: OpcoesEnriquecimento = {},
): Promise<DadosIa | null> {
  const nivel = NIVEIS_RACIOCINIO[opcoes.nivelRaciocinio ?? NIVEL_PADRAO];
  const buscarSocios = opcoes.buscarSocios ?? true;
  const buscarFundacao = opcoes.buscarFundacao ?? true;
  const buscarProcessos = opcoes.buscarProcessos ?? true;
  const camposCustomizados = (opcoes.camposCustomizados ?? []).map((c) => c.trim()).filter(Boolean);

  const usuarioEmail = email && email.includes("@") ? email.split("@")[0] : "";
  const ufHint = telefone ? ufProvavelPorTelefone(telefone) : null;

  let prompt =
    "Você é um pesquisador tentando identificar a EMPRESA (dado comercial, nunca CPF ou dado pessoal sensível) onde " +
    "este lead trabalha, a partir de sinais parciais. Use busca na web ativamente, em múltiplas frentes, sem desistir " +
    "numa tentativa só.\n\n" +
    "Estratégias (combine várias): (1) domínio do e-mail corporativo — geralmente é o site da empresa; (2) nome " +
    'completo + "LinkedIn"; (3) texto antes do @ como username, mesmo em e-mail pessoal; (4) telefone (com/sem +55 e ' +
    "DDD); (5) cruze pistas entre si.\n\n" +
    "JULGAMENTO DE IDENTIDADE — não é a mesma pessoa só porque o nome bate: nomes comuns pertencem a milhares de " +
    "pessoas. Só afirme uma empresa com corroboração real ligando ESTE lead (não um homônimo) a ela: telefone/e-mail " +
    "aparecendo no mesmo perfil da empresa, nome raro batendo com perfil verificável, ou domínio corporativo já sendo " +
    'a empresa. Sobrenome precisa bater EXATAMENTE (não aceite grafias parecidas mas diferentes, tipo "Fisbhen" vs ' +
    '"Fischen"). Sem corroboração real, é extrapolação — retorne "não encontrado".\n\n' +
    (ufHint
      ? `PISTA REGIONAL: o DDD indica que o lead provavelmente está em ${ufHint}. Reforce a busca com isso e, se a ` +
        `empresa encontrada for de outro estado sem explicação plausível, trate como sinal de homônimo e reduza a ` +
        `confiança.\n\n`
      : "") +
    "TAREFA PRINCIPAL, resolva isso primeiro e sozinha: decida empresa_nome (ou null), cargo, cnpj, municipio, uf, " +
    'website, linkedin_url, confianca ("alta"/"media"/"baixa") e fonte, usando SÓ os critérios acima. Critério de ' +
    'confiança: "alta" = dois ou mais sinais independentes convergem (ou domínio já é a empresa) sem conflito ' +
    'regional; "media" = um sinal forte específico; "baixa" = palpite sem corroboração real ou com conflito regional ' +
    'não explicado — nesse caso prefira {"empresa_nome": null} a arriscar um palpite errado.\n\n';

  // Itens extras (rodam DEPOIS da identificação, nunca influenciam ela) —
  // montados dinamicamente: só entram no prompt (e custam busca/tempo) os
  // que quem está usando realmente pediu.
  const extrasPedidos: string[] = [];
  if (buscarSocios) extrasPedidos.push("outros sócios/fundadores da empresa");
  if (buscarFundacao) extrasPedidos.push("data ou ano de fundação");
  extrasPedidos.push("outros dados comerciais úteis (setor, porte, produtos/serviços principais, clientes notáveis)");
  if (buscarProcessos) {
    extrasPedidos.push(
      'com uma busca dedicada (ex.: nome da empresa ou do lead + "jusbrasil" ou + "processo"), indício — nunca ' +
        'detalhe — de processo judicial ligado à empresa ou ao lead, só marcando "sim" se claramente for a mesma ' +
        "empresa/pessoa (mesmo cuidado contra homônimo de antes)",
    );
  }
  if (camposCustomizados.length) {
    const listaCampos = camposCustomizados.map((c) => `"${c}"`).join("; ");
    extrasPedidos.push(
      `e também, especificamente, estes itens pedidos por quem está usando essa busca: ${listaCampos} — pesquise ` +
        `objetivamente sobre cada um`,
    );
  }

  prompt +=
    "SÓ DEPOIS de já ter decidido tudo isso, faça mais algumas buscas (vale a pena buscar de verdade, isso é " +
    "informação que interessa — não é só aproveitar o que já apareceu por acaso) pra tentar descobrir: " +
    extrasPedidos.join("; ") +
    '. Não achou algum desses itens depois de tentar? Deixe null/"nao_encontrado" e siga em frente — mas NUNCA deixe ' +
    "de responder a tarefa principal, nem mude empresa_nome ou confianca, por causa desses itens extras; eles não " +
    "fazem parte do julgamento de identidade, só vêm depois dele já estar decidido.\n\n";

  const camposDesc = [
    "empresa_nome", "cargo", "cnpj", "municipio", "uf", "website", "linkedin_url",
    'confianca ("alta"/"media"/"baixa")',
    "fonte (frase curta e específica da corroboração usada)",
    "resumo (2 a 4 frases em português com contexto comercial da empresa — setor, porte, cidade, e outros dados " +
      "relevantes que achar; null se não achar empresa)",
  ];
  if (buscarSocios) camposDesc.push("socios (nomes separados por vírgula; null se não achar/não se aplicar)");
  if (buscarFundacao) camposDesc.push("fundacao (data ou ano; null se não achar)");
  if (buscarProcessos) camposDesc.push('processos_jusbrasil ("sim"/"nao"/"nao_encontrado")');
  if (camposCustomizados.length) {
    camposDesc.push(
      "extras (objeto JSON com uma chave EXATAMENTE igual a cada um dos itens pedidos acima — " +
        camposCustomizados.map((c) => `"${c}"`).join(", ") +
        " — com o que encontrar sobre aquilo, em texto curto, ou null se não achar)",
    );
  }

  prompt +=
    "Retorne SOMENTE um JSON (sem markdown) com: " + camposDesc.join(", ") + ".\n\n" +
    `Nome completo do lead: ${nome || "(não informado)"}\n` +
    `E-mail completo: ${email || "(não informado)"}` +
    (usuarioEmail ? ` (texto antes do @: "${usuarioEmail}")` : "") +
    `\nTelefone: ${telefone || "(não informado)"}`;

  const client = new OpenAI({ apiKey: openaiApiKey });

  // A CHAMADA em si (rede/API) tenta até 3 vezes — falha transitória (rate
  // limit, timeout, hiccup de rede) não deveria virar "não encontrado" pro
  // lead, é um problema técnico diferente. Depois de esgotar as tentativas,
  // propaga o erro pra quem chamou tratar como erro técnico.
  // max_tool_calls é um parâmetro real da Responses API (limita o total de
  // chamadas a tools embutidas numa resposta) — o SDK JS nesta versão só
  // declara esse campo no tipo de retrieve, não no de create, por isso o
  // tipo é estendido manualmente aqui em vez de deixar a checagem de
  // propriedade excedente do literal barrar um campo que a API aceita.
  const body: OpenAI.Responses.ResponseCreateParamsNonStreaming & { max_tool_calls?: number } = {
    model: "gpt-5-mini",
    tools: [{ type: "web_search" }],
    input: prompt,
    reasoning: { effort: nivel.reasoningEffort },
    text: { verbosity: nivel.verbosity },
    max_tool_calls: nivel.maxToolCalls,
  };

  let resp: OpenAI.Responses.Response | null = null;
  let ultimoErro: unknown = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      resp = await client.responses.create(body, { timeout: 240_000 });
      break;
    } catch (e) {
      ultimoErro = e;
    }
  }
  if (!resp) {
    const msg = ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro);
    throw new Error(`busca via IA falhou após 3 tentativas: ${msg}`);
  }

  try {
    const texto = resp.output_text || "";
    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const dados: DadosIa = JSON.parse(match[0]);
    if (!dados.empresa_nome) return null;
    const confianca = (dados.confianca || "").trim().toLowerCase();
    if (confianca !== "alta" && confianca !== "media") return null;
    const empresaUf = (dados.uf || "").trim().toUpperCase();
    if (ufHint && empresaUf && empresaUf !== ufHint && confianca !== "alta") return null;
    return dados;
  } catch {
    return null;
  }
}

export interface ResultadoEnriquecimento {
  status: EnrichmentLeadStatus;
  empresa_nome: string | null;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  website: string | null;
  cargo: string | null;
  linkedin_url: string | null;
  resumo: string | null;
  socios: string | null;
  fundacao: string | null;
  processos_jusbrasil: string | null;
  extras: Record<string, string> | null;
  erro: string | null;
}

/**
 * Roda o enriquecimento (só IA) pra um lead e retorna um resultado
 * estruturado. status: "concluido" | "nao_encontrado" | "erro" (falha
 * técnica, distinto de "não achou nada").
 */
export async function enriquecerLead(
  nome: string,
  email: string,
  telefone: string,
  openaiApiKey: string,
  opcoes: OpcoesEnriquecimento = {},
): Promise<ResultadoEnriquecimento> {
  const resultado: ResultadoEnriquecimento = {
    status: "nao_encontrado",
    empresa_nome: null, cnpj: null, municipio: null, uf: null, website: null,
    cargo: null, linkedin_url: null, resumo: null, socios: null, fundacao: null,
    processos_jusbrasil: null, extras: null, erro: null,
  };

  if (!openaiApiKey) {
    resultado.status = "erro";
    resultado.erro = "Chave da OpenAI não configurada — cadastre em Configurações.";
    return resultado;
  }

  let dadosIa: DadosIa | null;
  try {
    dadosIa = await enriquecerViaIa(nome, email, telefone, openaiApiKey, opcoes);
  } catch (e) {
    resultado.status = "erro";
    resultado.erro = String(e instanceof Error ? e.message : e).slice(0, 500);
    return resultado;
  }

  if (dadosIa) {
    const buscarSocios = opcoes.buscarSocios ?? true;
    const buscarFundacao = opcoes.buscarFundacao ?? true;
    const buscarProcessos = opcoes.buscarProcessos ?? true;
    const camposCustomizados = opcoes.camposCustomizados ?? [];

    resultado.status = "concluido";
    resultado.empresa_nome = dadosIa.empresa_nome ?? null;
    resultado.cnpj = dadosIa.cnpj ?? null;
    resultado.municipio = dadosIa.municipio ?? null;
    resultado.uf = dadosIa.uf ?? null;
    resultado.website = dadosIa.website ?? null;
    resultado.cargo = dadosIa.cargo ?? null;
    resultado.linkedin_url = dadosIa.linkedin_url ?? null;
    resultado.resumo = dadosIa.resumo ?? null;
    resultado.socios = buscarSocios ? (dadosIa.socios ?? null) : null;
    resultado.fundacao = buscarFundacao ? (dadosIa.fundacao ?? null) : null;
    resultado.processos_jusbrasil = buscarProcessos ? normalizarSimNao(dadosIa.processos_jusbrasil) : null;
    resultado.extras = camposCustomizados.length ? (dadosIa.extras ?? null) : null;
  }

  return resultado;
}
