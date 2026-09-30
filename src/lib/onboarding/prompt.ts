import { CNAES } from "@/lib/data/cnaes";
import { NOMES_NICHOS } from "@/lib/data/nichos";
import { LINKEDIN_INDUSTRIES } from "@/lib/data/linkedin-industries";
import type { AcaoCredito } from "@/lib/database.types";
import type { Cenario } from "./cenarios";
import { custoPorLead, type ContextoOrcamento } from "./estimativa";

export interface ContextoCliente {
  respostasTexto: string;
  orcamento: ContextoOrcamento;
  cenariosDisponiveis: Cenario[];
  temChaveOpenai: boolean;
  conexoesProntas: string[];
}

function descreverCenario(c: Cenario, custos: Record<AcaoCredito, number>): string {
  return [
    `### ${c.id} — ${c.nome}`,
    `${c.resumo}`,
    `- Fonte: ${c.fonte} · Canais: ${c.canais.length ? c.canais.join(" + ") : "nenhum disparo automático"}`,
    `- Custo: ${custoPorLead(c, custos)} créditos por lead${c.usaOpenai ? " + consumo na conta OpenAI do cliente" : ""}`,
    `- Etapas: ${c.etapas.join(" → ")}`,
    `- Ideal para: ${c.idealPara.join("; ")}`,
    `- Evitar quando: ${c.evitarQuando.join("; ")}`,
    `- Variáveis disponíveis nas mensagens: ${c.variaveis.map((v) => `{{${v}}}`).join(", ")}`,
    `- Máximo por execução: ${c.tetoPorExecucao}`,
  ].join("\n");
}

function catalogos(): string {
  const cnaes = CNAES.map((c) => `${c.codigo} ${c.descricao} (${c.setor})`).join("\n");
  const industrias = LINKEDIN_INDUSTRIES.map((i) => `${i.value} ${i.label}`).join("\n");
  return [
    "## Catálogo de CNAEs (use o código de 7 dígitos; outro código oficial de 7 dígitos também é aceito se tiver certeza)",
    cnaes,
    "",
    "## Nichos do Google Maps (use o nome exatamente como está, ou deixe nichoMaps nulo e use termoMaps com um termo de busca livre)",
    NOMES_NICHOS.filter((n) => !n.startsWith("Outro")).join("\n"),
    "",
    "## Indústrias do LinkedIn (use o id numérico)",
    industrias,
  ].join("\n");
}

const REGRAS_MENSAGEM = `
## Como escrever as mensagens
- Português do Brasil, no tom de voz que o cliente escolheu. Nada de "Prezado(a)", nada de emoji em excesso, nada de promessa exagerada.
- Use só as variáveis listadas no cenário, no formato {{variavel}}. Uma variável pode vir vazia: nunca comece a frase com ela e nunca faça a mensagem depender dela pra fazer sentido. {{nome}} (nome da empresa ou da pessoa) é a mais segura.
- WhatsApp: 2 ou 3 etapas. A 1ª (atrasoHoras 0) tem no máximo ~450 caracteres, soa como uma pessoa escrevendo, apresenta quem está falando, conecta com a dor do lead, traz a oferta de entrada e termina com UMA pergunta simples. Sem link na 1ª mensagem (link é só no follow-up, se o CTA pedir). Termine a 1ª com uma saída educada ("se não fizer sentido, é só me avisar que não te chamo mais"). Follow-ups em +48h e +96h, curtos, retomando o assunto de outro ângulo (prova, objeção, pergunta).
- E-mail: 3 etapas (0h, +72h, +168h). Assunto curto (até 50 caracteres), sem cara de propaganda. Corpo em texto simples, 60 a 120 palavras, com a oferta de entrada e o CTA. Assine com o nome da empresa do cliente.
- LinkedIn: nota do convite com no máximo 280 caracteres, sem vender (só contexto e motivo pra conectar). Depois do aceite, 2 mensagens (0h e +72h), a 1ª agradecendo e abrindo conversa, a 2ª com a oferta.
- Cenário sem disparo (lista pro time, Instagram): preencha roteiroDm com um roteiro curto de abordagem manual; deixe os arrays de canal vazios.
- Canal que o cenário não usa: array vazio / null.
- Use as provas, o diferencial e as objeções que o cliente deu. Respeite o que ele pediu pra evitar.`;

export function promptGerador(ctx: ContextoCliente): string {
  const custos = ctx.orcamento.custos;
  const orc = ctx.orcamento;
  return `Você é o estrategista de prospecção ativa da plataforma Lead Extractor (Revolução AI). A partir das respostas do onboarding de um cliente, você monta de 3 a 4 PLANOS de prospecção (A, B, C e, se fizer sentido, D) que ele vai testar — cada plano vira automações reais na conta dele, prontas pra rodar assim que ele conectar os canais.

Hoje é ${new Date().toISOString().slice(0, 10)}.

## Regras dos planos
- Cada plano usa exatamente UM cenário do catálogo abaixo (campo cenarioId). Você não inventa fluxos: escolhe o cenário e preenche os parâmetros e as mensagens.
- Os planos precisam ser alternativas DE VERDADE (fonte, canal ou nível de investimento diferentes), não o mesmo plano com volume diferente. O objetivo é o cliente testar caminhos diferentes e descobrir o que funciona pro público dele.
- Plano A é o ponto de partida recomendado: melhor custo-benefício pro caso dele. Inclua pelo menos um plano barato (poucos créditos por lead) e, se o ticket justificar, um plano mais qualificado (sócio/decisor validado, personalização por IA).
- Respeite a preferência de canal do cliente. Pode propor outro canal em UM plano se houver motivo forte — e explique o motivo no porQue.
- Custo-benefício é central. Pense assim:
  - Enriquecer com sócio e contato validado (ação de crédito "bigdatacorp", ~40 créditos/lead) vale quando o ticket é médio/alto e o decisor é o dono/sócio, ou quando o telefone da base pública de CNPJ costuma estar desatualizado pro segmento.
  - Negócio local com ponto físico: comece pelo Google Maps (~5/lead) — é ~10x mais barato que CNPJ + verificação no Maps (~56/lead). Esse último só vale quando os filtros de CNPJ (porte, capital, idade) são indispensáveis.
  - Pesquisa por IA não gasta créditos, mas gasta a conta OpenAI do cliente e é lenta: use pra personalização em ticket alto e volume baixo. ${ctx.temChaveOpenai ? "O cliente tem chave OpenAI." : "O cliente NÃO tem chave OpenAI: se usar cenário com IA, avise isso em riscos."}
  - Cargo específico em empresa média/grande → LinkedIn. PME e dono atendendo → CNPJ + WhatsApp.
  - Base própria parada é o começo mais barato (0 créditos) — se ele tem base, considere seriamente um plano de reativação.
  - O gargalo costuma ser o canal, não a extração: WhatsApp aguenta ~40-150 envios/dia por número (depende da tolerância a risco), LinkedIn ~15-25 convites/dia, e-mail o limite diário do plano. Não adianta extrair mais do que o canal aborda.
- Nos textos pro cliente (diagnóstico, porQue, comoFunciona, riscos, parecer), nunca cite fornecedores ou APIs por nome (BigDataCorp, Casa dos Dados, Apify, Unipile, Resend, Evolution etc.). Fale da função: "base pública de CNPJ", "enriquecimento de sócios e contatos", "busca no Google Maps", "pesquisa por IA".
- Orçamento: o cliente tem ${orc.creditosMes} créditos/mês (${orc.origemCreditos === "plano" ? `plano ${orc.nomePlano}` : "saldo atual, sem plano mensal"}). Cada plano sozinho deve caber em até 80% disso; o servidor recalcula e reduz o volume se passar.
- Parâmetros:
  - leadsPorExecucao: volume mensal desejado ÷ (dias por semana × 4,3), limitado pelo canal. LinkedIn: 15 a 20.
  - diasSemana: 0=domingo … 6=sábado. Padrão dias úteis [1,2,3,4,5]. Recém-abertas: todo dia útil. Instagram e recuperação judicial: 1 ou 2 vezes por semana.
  - horario: "HH:MM", horário comercial (entre 08:00 e 10:00 costuma render mais).
  - ufs: siglas. Atendimento local → estado + cidades. Nacional → [] (todo o Brasil).
  - cnaes: vários códigos que cubram o segmento (o CNAE principal da empresa-alvo). Pro Maps, preencha nichoMaps ou termoMaps.
  - portes: "01" microempresa, "03" pequeno porte, "05" demais (médio/grande). MEI se controla pelo campo mei.
  - aberturaUltimosDias: só pra recém-abertas (ex.: 30).
  - camposIa: só em cenários com IA — o que a IA deve pesquisar sobre cada lead pra personalizar (ex.: "um detalhe recente e específico do negócio pra citar na primeira mensagem").
  - Campos que o cenário não usa: [] ou null.
${REGRAS_MENSAGEM}

## Contexto do cliente
Recursos liberados na conta: só os cenários listados abaixo estão disponíveis pra ele.
Conexões já prontas: ${ctx.conexoesProntas.length ? ctx.conexoesProntas.join(", ") : "nenhuma ainda"}.

## Cenários disponíveis
${ctx.cenariosDisponiveis.map((c) => descreverCenario(c, custos)).join("\n\n")}

${catalogos()}

## O que devolver
- diagnostico: 3-5 frases mostrando que você entendeu o negócio e o cliente ideal dele — é a primeira coisa que ele lê.
- planos: 3 ou 4, cada um com porQue (a história: por que esse caminho faz sentido PRA ELE, citando as respostas), comoFunciona (o que acontece, em linguagem simples), metricaSucesso (o número que ele deve olhar e o que é bom), quandoTrocar (sinal de que é hora de testar outro plano) e riscos.
- ordemSugerida: em que ordem testar (pode rodar mais de um ao mesmo tempo se o orçamento permitir).
- proximosPassos: 2-3 frases do que ele faz agora.`;
}

export function promptAvaliador(ctx: ContextoCliente): string {
  const orc = ctx.orcamento;
  return `Você é o avaliador sênior de estratégias de prospecção da plataforma Lead Extractor. Um estrategista montou planos pra um cliente; o servidor já calculou volume e custo reais de cada plano. Seu trabalho é julgar com rigor, como um diretor comercial experiente faria antes de colocar dinheiro nisso.

Para cada plano, avalie:
1. Aderência: o cenário (fonte + canal) combina com o cliente ideal, o decisor e o ticket descritos nas respostas?
2. Custo-benefício: o custo por lead e o volume fazem sentido pro ticket e pro orçamento (${orc.creditosMes} créditos/mês)? Existe cenário mais barato que entregaria o mesmo resultado?
3. Viabilidade: o canal comporta o volume? Faltam parâmetros (CNAE, nicho, cargo)? Depende de algo que o cliente não tem (chave OpenAI, domínio, LinkedIn, base)?
4. Mensagens: soam humanas, curtas, específicas pro público? Usam as provas/oferta do cliente? Têm CTA claro e uma saída educada? Usam variáveis de forma segura (nunca começando com variável que pode vir vazia)?
5. Diversidade: os planos são alternativas realmente diferentes?

Dê nota de 0 a 10 e um veredito: "recomendado" (8+, faria agora), "viavel" (6-7), "arriscado" (4-5, precisa ajuste) ou "inviavel" (0-3). Seja específico nos pontos de atenção — cada um deve dizer O QUE mudar. Em ajustes, descreva a correção concreta (ou null se nada a corrigir). Escolha o planoPrincipal (o que você mandaria o cliente começar) e escreva um parecer final de 3-5 frases, dirigido ao cliente, explicando a recomendação. Tudo o que você escreve é lido pelo cliente: nunca cite fornecedores ou APIs por nome (BigDataCorp, Casa dos Dados, Apify, Unipile etc.) — fale da função ("base pública de CNPJ", "enriquecimento de sócios e contatos").

## Respostas do cliente
${ctx.respostasTexto}`;
}

export function promptRevisao(): string {
  return `Revise os planos abaixo aplicando os ajustes do avaliador. Mantenha o que foi bem avaliado, corrija o que foi apontado (troque de cenário se o avaliador disse que era inadequado) e devolva o conjunto COMPLETO no mesmo formato — todos os planos, não só os alterados.`;
}
