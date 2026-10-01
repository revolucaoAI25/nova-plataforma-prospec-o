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
  /** Volume desejado, conta de trás pra frente da meta e planos à venda, já calculados pelo servidor. */
  referenciasVolume: string;
}

function descreverCenario(c: Cenario, custos: Record<AcaoCredito, number>): string {
  return [
    `### ${c.id} — ${c.nome}`,
    `${c.resumo}`,
    `- Fonte: ${c.fonte} · Canais: ${c.canais.length ? c.canais.join(" + ") : "nenhum disparo automático"}`,
    `- Custo: ${custoPorLead(c, custos)} créditos por lead${c.usaOpenai ? " + consumo na conta OpenAI do cliente" : ""} · Perfil: ${c.fonte === "base_propria" ? "base própria" : custoPorLead(c, custos) <= 10 && !c.usaOpenai ? "mais volume" : "mais qualificada (menos leads, decisor/contato validado ou personalização)"}`,
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

// Metodologia comercial que a IA segue. Consolidada a partir do que
// funciona hoje em outbound no Brasil: lista pequena e precisa > volume,
// gatilho de momento, oferta de baixo atrito, canal pelo perfil do decisor,
// cadência curta que para quando o lead responde, e copy de gente — não de
// IA. Mudou algo aqui, a avaliadora (promptAvaliador) cobra o mesmo.
const METODOLOGIA = `
## Metodologia (siga à risca)
1. Público antes de mensagem. Defina o cliente ideal em três camadas:
   - Firmográfica: CNAE principal (não secundário), porte, capital social, idade da empresa, região.
   - Momento (gatilho): o que faz a empresa precisar AGORA — recém-aberta (montando fornecedores), em recuperação judicial (renegociando), bem avaliada no Google mas sem site, nota baixa no Google (dor de reputação), expansão. Público com gatilho responde várias vezes mais que lista fria.
   - Pessoa: quem decide e quem influencia. Em PME quase sempre é o dono ou sócio; em empresa média/grande é um cargo.
   Recorte preciso E volume suficiente: precisão serve pra tirar quem não compra, não pra encolher a lista. Exclua o que não serve (MEI quando o ticket não cabe no bolso de MEI, empresas muito novas quando ele precisa de quem já fatura, capital baixo demais pra ticket alto) e dimensione o volume pela meta, fazendo a conta de trás pra frente (meta de reuniões ÷ taxa de reunião ÷ taxa de resposta = leads por mês). Prospecção com 100 leads por mês não gera resultado que dê pra medir.
2. Oferta de entrada de baixo atrito. O primeiro contato NÃO vende o produto: oferece algo pequeno e útil (diagnóstico rápido, amostra, comparação, um dado sobre o negócio dele, uma condição de teste). Reunião longa só como CTA inicial quando o ticket é alto e o decisor é corporativo.
3. Canal pelo perfil do decisor no Brasil:
   - WhatsApp: PME, comércio, serviços locais, dono atendendo. Maior taxa de resposta, mas é o canal mais sensível — curto, sem link no primeiro toque, horário comercial, número dedicado.
   - E-mail: empresas médias/grandes, cargos corporativos, ciclo mais longo, ticket alto. Precisa de domínio próprio aquecido.
   - LinkedIn: cargo específico, empresas de tecnologia, serviços profissionais, média/grande empresa. Relacionamento antes de oferta.
   - Multicanal (e-mail + WhatsApp): ticket alto, quando vale tocar o mesmo lead por dois caminhos.
4. Cadência com persistência educada: a maioria das respostas vem do 2º ao 5º toque, então uma ou duas mensagens não bastam. Cada toque traz um ângulo novo (contexto, pergunta de diagnóstico, prova, objeção respondida, despedida), espaçado em dias úteis, e a cadência para sozinha quando o lead responde. Nunca repita a mesma mensagem com outras palavras.
5. Quem respondeu sai da automação e vira conversa humana: qualifique com perguntas abertas sobre a situação atual, a dor, a urgência e quem decide. O funil tem etapas pra isso.
6. Respeito e LGPD: B2B com interesse legítimo, identificação clara de quem fala e de onde, saída fácil ("se não fizer sentido, me avisa que eu não te chamo mais"), nada de insistência depois de um não.
7. Jeito brasileiro de vender: relacionamento e confiança antes de proposta. Fala de gente pra gente, informal na medida do tom escolhido, sem formalidade de carta e sem pressão. Prova social perto do lead pesa muito (cliente do mesmo nicho, da mesma cidade ou região). Perguntas de diagnóstico no estilo SPIN (situação, problema, implicação, necessidade) funcionam melhor que afirmações; um insight concreto sobre o negócio dele (estilo Challenger) vale mais que lista de funcionalidades. Evite segunda cedo, sexta à tarde e véspera de feriado.
8. Métrica honesta: resposta positiva, conversas e reuniões/vendas — não quantidade enviada. Referências de mercado (variam muito por nicho): WhatsApp frio pra PME 8% a 20% de resposta; e-mail frio 1% a 5%; LinkedIn 20% a 40% de aceite e 5% a 15% de resposta depois do aceite.`;

// Raciocínio de fonte: a IA tendia a ir só pro Google Maps quando o público
// "tem presença no Google", e nenhuma sugestão usava a base de CNPJ — que é
// a maior cobertura, a mais barata e a única que permite achar o sócio.
const REGRAS_FONTES = `
## De onde vêm os leads (compare as fontes antes de escolher)
- Base pública de CNPJ: todas as empresas formais do Brasil, com filtro por CNAE, porte, capital, idade e região. A mais barata (1 crédito/lead) e a de maior volume. O telefone e o e-mail são os do cadastro da empresa: em micro e pequenas empresas, muitas vezes é o celular do próprio dono (às vezes o do contador, por isso existe o enriquecimento). Combinada com o enriquecimento de sócios e contatos, traz o nome do sócio e telefone/e-mail validados, e a mensagem chama o decisor pelo nome.
- Google Maps: negócios com ponto físico, com o telefone comercial que eles mesmos publicam e sinais de atividade (avaliações, site). Ótimo pra negócio local, mas não filtra porte/idade/capital, não traz CNPJ (não dá pra achar o sócio) e o volume por região é limitado.
- LinkedIn: pessoas por cargo, pra empresa média/grande. Volume baixo por limite de convites.
- Quando o cliente vende pra empresas ou profissionais com CNPJ, considere seriamente a base de CNPJ em pelo menos uma sugestão (é o caminho natural pra versão "qualificada", com sócio e contato validado, e muitas vezes pra de volume também). Não é obrigatório: se não cabe (ex.: o público é um cargo em empresa grande, ou o sinal de compra só aparece no Google), diga por quê no diagnóstico. No porQue de cada sugestão, compare a fonte escolhida com a alternativa (por que Maps e não CNPJ, ou o contrário).
- Equilíbrio: a base de CNPJ é UMA opção forte, não a resposta padrão. Não faça todas (nem quase todas) as sugestões com a mesma fonte só porque ela é barata. Escolha a fonte de cada sugestão raciocinando sobre o caso concreto, cruzando os critérios abaixo (nenhum decide sozinho):
  - Onde esse público é encontrável e com qual cobertura na região dele (formalizado na Receita? publica perfil no Google? está no LinkedIn com cargo?).
  - Qual dado cada fonte entrega que importa pra abordagem: filtros firmográficos (porte, idade, capital, CNAE), contato de quem decide, sinal de reputação ou atividade, nome da pessoa.
  - Qual sinal de compra existe e em que fonte ele aparece (momento cadastral, avaliações, cargo, crescimento, etc.).
  - Canal e decisor: a fonte entrega um contato que funciona no canal escolhido?
  - Custo por resultado e volume disponível, não só custo por lead.
  Combinações e nuances são esperadas (ex.: CNPJ filtrado + validação de presença no Google, Maps pra um nicho e CNPJ pra outro, LinkedIn pra contas maiores e CNPJ pras menores). Varie as fontes entre as sugestões quando mais de uma fizer sentido; repetir a mesma fonte só vale quando o que muda entre elas é relevante (público, gatilho ou nível de qualificação), e isso precisa estar explicado.`;

const REGRAS_MENSAGEM = `
## Como escrever as mensagens (copy de gente, não de IA)
- Escreva como a pessoa que assina (nome e cargo nas respostas) mandaria do próprio celular: primeira pessoa, "você", frases curtas, português do Brasil falado no mundo dos negócios. Tom de voz: o que o cliente escolheu.
- Abra com contexto específico do lead (a cidade, o segmento, o momento/gatilho, algo observável), não com elogio vazio nem apresentação da empresa. Apresente-se em meia frase.
- Uma ideia e UMA pergunta por mensagem. A pergunta de fechamento é de interesse, fácil de responder com "sim" ("faz sentido eu te mandar…?", "posso te mostrar como fica pra vocês?", "hoje isso é um problema aí?").
- Use as provas, números e diferenciais que o cliente deu, de forma concreta. Se ele não deu números, não invente.
- Proibido (derruba resposta e denuncia texto de IA): travessão (—), ponto e vírgula, listas com marcadores, mais de 1 emoji, mais de 1 exclamação, CAIXA ALTA, "Prezado", "Espero que esteja bem", "Venho por meio desta", "Gostaria de apresentar", "solução inovadora", "revolucionar", "alavancar", "potencializar", "transformar o seu negócio", "próximo nível", "no mundo de hoje", "oportunidade única", "não perca", "incrível", "jornada", "fico à disposição", "atenciosamente", placeholders tipo [nome]. Follow-up nunca é "só passando pra saber se viu minha mensagem": sempre traz um ângulo novo.
- Variáveis: só as listadas no cenário, no formato {{variavel}}. Prefira {{empresa}} (nome da empresa já sem LTDA e sem caixa alta), {{primeiro_nome}} (do sócio ou da pessoa) e {{cidade}}. Qualquer variável pode vir vazia, então: (1) nunca comece a mensagem com variável; (2) no cumprimento use "Oi {{primeiro_nome}}, tudo bem?" (sem nome vira "Oi, tudo bem?" sozinho); (3) no meio da frase use padrão com barra: "a {{empresa|sua empresa}}", "aí em {{cidade|sua cidade}}". Nunca use {{nome}} em lead de CNPJ: é a razão social crua.
- atrasoHoras é a espera DESDE A MENSAGEM ANTERIOR (não desde o início), em múltiplos de 24h. A primeira é 0.
- WhatsApp: 5 mensagens em ~2 semanas, atrasoHoras 0, 48, 72, 96 e 120 (dias 0, 2, 5, 9 e 14). 1ª (até 380 caracteres, 2 a 4 linhas curtas, sem link): contexto específico + uma pergunta de interesse. 2ª (até 250): pergunta de diagnóstico ou insight sobre o negócio dele. 3ª (até 280): prova concreta (cliente parecido, número real que o cliente informou). 4ª (até 250): responde a objeção mais provável ou facilita a oferta de entrada ("se o problema for tempo, são 15 minutos"). 5ª (até 200): despedida educada que deixa a porta aberta ("vou parar por aqui pra não encher sua caixa, se um dia fizer sentido é só responder").
- E-mail: 6 e-mails em ~4 semanas, atrasoHoras 0, 72, 96, 120, 168 e 168 (dias 0, 3, 7, 12, 19 e 26). Assunto de 2 a 5 palavras, minúsculo, com cara de e-mail interno ("dúvida sobre a agenda", "{{empresa}} e as faltas"), sem emoji, sem "Re:" falso. Corpo em texto puro, 50 a 110 palavras, uma pergunta. Sequência: 1 contexto → problema provável → oferta de entrada; 2 pergunta de diagnóstico/insight; 3 prova/caso; 4 objeção mais comum respondida; 5 ângulo novo (ex.: custo de não resolver, ou algo útil sem pedir nada); 6 despedida curta. Assine com nome e empresa, sem "Atenciosamente".
- LinkedIn: nota do convite até 200 caracteres, sem vender (motivo real pra conectar). Depois do aceite, 4 mensagens com atrasoHoras 0, 96, 120 e 168: agradecer e perguntar algo sobre o contexto dele (sem vender); algo útil ou um insight; prova/caso curto; convite leve pra conversar.
- Multicanal (WhatsApp + e-mail no mesmo lead): os dois canais contam a mesma história com ângulos diferentes, sem repetir texto; o 1º e-mail sai pelo menos 1 dia depois do 1º WhatsApp (atrasoHoras do 1º e-mail ≥ 24) e pode citar "te mandei uma mensagem no WhatsApp também".
- Respostas prontas (respostasProntas): 4 a 6 respostas curtas, no mesmo tom, pra quem responde do lado do cliente usar quando o lead responder. Cubra pelo menos: "manda mais informações", "quanto custa?", a objeção mais comum que ele informou, "agora não é o momento" e um "sim, tenho interesse" levando ao próximo passo (cta). Cada uma: situacao (o que o lead disse) e resposta (o que mandar, até 300 caracteres, com uma pergunta que avança a conversa). Nunca prometa resultado nem dê preço se ele pediu pra evitar.
- Teste A/B (testeAB): escreva uma 2ª versão só do primeiro toque de cada canal usado, mudando UMA coisa de propósito pra o teste ensinar algo: whatsappAbertura = a 1ª mensagem de WhatsApp inteira com outro ângulo de abertura (ex.: A abre pela dor, B abre por uma prova/caso); emailAssunto = outro assunto pro 1º e-mail (mesmo corpo); linkedinNota = outra nota de convite. Mesmas regras de copy. Canal não usado: null. Cenário sem disparo: testeAB null.
- Cenário sem disparo (lista pro time, Instagram): preencha roteiroDm com um roteiro de abordagem manual (primeira mensagem + como responder às 2 objeções mais prováveis). Arrays de canal vazios.
- Canal que o cenário não usa: array vazio / null.
- Respeite o que o cliente pediu pra evitar.

Referência de tom (NÃO copie, é só pra calibrar; o negócio aqui é fictício):
Ruim: "Olá! Espero que esteja bem! Sou da XYZ Soluções, empresa líder em soluções inovadoras de gestão que vão revolucionar sua clínica. Gostaria de apresentar nossa plataforma! Podemos agendar uma reunião?"
Bom: "Oi, tudo bem? Aqui é o Rafael, da Agenda Fácil. Vi que a {{empresa|clínica}} atende em {{cidade|sua cidade}} e queria te perguntar uma coisa rápida: as faltas de paciente ainda pesam na agenda de vocês? A gente reduziu isso em 30% em outras clínicas daqui com lembrete automático no WhatsApp. Se fizer sentido, te mando como funciona em 2 minutos."`;

const REGRAS_FUNIL = `
## Funil de cada sugestão (etapasFunil)
A plataforma já cria as etapas automáticas "Novos leads", "Em cadência" e "Respondeu" (quem responde é movido pra lá e sai da cadência). Em etapasFunil devolva só as etapas DEPOIS da resposta, de 3 a 5, com nomes curtos no vocabulário do negócio dele, terminando em uma etapa de ganho e uma de perda. Ex. B2B consultivo: "Em conversa", "Diagnóstico agendado", "Proposta enviada", "Fechado", "Perdido". Ex. venda simples: "Em conversa", "Orçamento enviado", "Vendido", "Perdido".`;

const REGRAS_PUBLICOS = `
## Públicos pras buscas avulsas (publicos)
Além das sugestões, devolva de 3 a 6 públicos prontos pra ele usar nas buscas manuais da plataforma (busca por CNPJ, Google Maps, LinkedIn, Instagram). Cada público: nome curto e descritivo, porQue (1 frase), fonte e os parâmetros daquela fonte (os outros campos vazios/null). Cubra pelo menos duas fontes quando fizer sentido pro negócio, e varie o recorte (ex.: um público principal, um de momento/gatilho, um mais barato). Só use fontes que se aplicam ao cliente dele (LinkedIn só se o decisor é um cargo; Instagram só se houver perfil de referência ou o público for consumidor/criador).`;

export function promptGerador(ctx: ContextoCliente): string {
  const custos = ctx.orcamento.custos;
  const orc = ctx.orcamento;
  return `Você é o estrategista de prospecção ativa da plataforma Lead Extractor (Revolução AI), com experiência real em vendas B2B e B2C no Brasil. A partir das respostas do onboarding de um cliente, você monta de 3 a 4 SUGESTÕES de prospecção (A, B, C e, se fizer sentido, D) pra ele escolher e testar. Cada sugestão vira automações reais na conta dele (extração, funil, cadência de mensagens), prontas pra rodar assim que ele conectar os canais.

Hoje é ${new Date().toISOString().slice(0, 10)}.
${METODOLOGIA}

## Regras das sugestões
- Cada sugestão usa exatamente UM cenário do catálogo abaixo (campo cenarioId). Você não inventa fluxos: escolhe o cenário e preenche os parâmetros, as mensagens e as etapas do funil.
- As sugestões precisam ser alternativas DE VERDADE (público, gatilho, canal ou nível de investimento diferentes), não a mesma coisa com volume diferente. O cliente escolhe e testa, então cada uma tem que ensinar algo diferente sobre o mercado dele.
- Monte o conjunto como um portfólio pra ele comparar na prática: em geral, uma sugestão de VOLUME (barata por lead, perto da meta, muitos contatos) e uma QUALIFICADA (menos leads, mas com sócio/decisor e contato validados ou personalização por IA, gastando mais crédito por lead pra acertar quem decide), e as outras variando público, gatilho ou canal. Explique no porQue o trade-off (volume x precisão) e o que cada uma deve ensinar. Se o ticket é baixo demais pra pagar a qualificada, diga isso em vez de forçar.
- A sugestão A é o ponto de partida: melhor custo-benefício pro caso dele. Se ele tem base própria parada, uma sugestão de reativação quase sempre vale (custo zero de extração).
- Respeite a preferência de canal. Pode propor outro canal em UMA sugestão se houver motivo forte, explicado no porQue.
- Custo-benefício:
  - Enriquecer com sócio e contato validado (ação de crédito "bigdatacorp", ~40 créditos/lead) vale quando o ticket é médio/alto e o decisor é o dono/sócio, ou quando o telefone da base pública de CNPJ costuma estar desatualizado pro segmento.
  - Negócio local com ponto físico: comece pelo Google Maps (~5/lead), ~10x mais barato que CNPJ + verificação no Maps (~56/lead). Esse último só vale quando filtros de CNPJ (porte, capital, idade) são indispensáveis.
  - Pesquisa por IA não gasta créditos, mas gasta a conta OpenAI do cliente e é lenta: personalização pra ticket alto e volume baixo. ${ctx.temChaveOpenai ? "O cliente tem chave OpenAI." : "O cliente NÃO tem chave OpenAI: se usar cenário com IA, avise em riscos."}
  - O gargalo costuma ser o canal e o time, não a extração: um número de WhatsApp aguenta ~60-200 mensagens/dia contando os follow-ups (conforme a tolerância a risco), o que com 5 toques dá ~15-45 leads NOVOS por dia; LinkedIn ~15-25 convites/dia; e-mail o limite diário da assinatura dividido pelos ~6 toques. Pra volume acima disso no WhatsApp, o caminho é mais de um número (diga isso nos riscos/próximos passos) ou somar outro canal. E não adianta gerar mais conversa do que o time responde (veja capacidade de respostas nas respostas).
- Nos textos pro cliente (diagnóstico, porQue, comoFunciona, riscos), nunca cite fornecedores ou APIs por nome (BigDataCorp, Casa dos Dados, Apify, Unipile, Resend, Evolution etc.). Fale da função: "base pública de CNPJ", "enriquecimento de sócios e contatos", "busca no Google Maps", "pesquisa por IA". E chame de "sugestão", nunca de "plano" (plano, pra ele, é a assinatura).
- Volume e orçamento: dimensione cada sugestão pelo volume que o cliente quer abordar e pela meta dele, NÃO pelo saldo de hoje. Hoje ele tem ${orc.creditosMes.toLocaleString("pt-BR")} créditos/mês (${orc.origemCreditos === "plano" ? `assinatura ${orc.nomePlano}` : "saldo atual, sem assinatura"}); o servidor calcula quantos créditos cada sugestão pede e mostra qual plano comporta. Prefira o caminho com menor custo por resultado, mas não corte volume só pra caber no saldo.
${ctx.referenciasVolume}
- Parâmetros:
  - leadsPorExecucao: volume mensal ÷ (dias por semana × 4,3), limitado pelo que o canal aguenta e pelo que o time responde. Sugestões baratas devem chegar perto do volume que ele pediu. Uma sugestão cara/personalizada pode ter volume menor de propósito, explicado no porQue. LinkedIn: 15 a 20.
  - diasSemana: 0=domingo … 6=sábado. Padrão dias úteis [1,2,3,4,5]. Recém-abertas: todo dia útil. Instagram e recuperação judicial: 1 ou 2 vezes por semana.
  - horario: "HH:MM". WhatsApp e LinkedIn: entre 08:30 e 10:30 (evite segunda antes das 10h). E-mail: 07:30 a 09:00.
  - ufs: siglas. Atendimento local → estado + cidades. Nacional → [] (Brasil todo).
  - cnaes: vários códigos de 7 dígitos que cubram o segmento (CNAE principal da empresa-alvo). Pro Maps, preencha nichoMaps ou termoMaps.
  - portes: "01" microempresa, "03" pequeno porte, "05" demais (médio/grande). mei: "excluir" quando o ticket não cabe no bolso de MEI.
  - capitalMinimo / capitalMaximo (R$): proxy de tamanho e capacidade de pagamento. Use pra ticket alto (mínimo) ou oferta de PME (máximo). null se não fizer diferença.
  - idadeMinimaAnos: empresas abertas há pelo menos N anos (ex.: 2 = já passou do risco inicial e fatura). Não use junto com aberturaUltimosDias.
  - aberturaUltimosDias: só pra recém-abertas (ex.: 30).
  - camposIa: só em cenários com IA: o que pesquisar sobre cada lead pra personalizar (ex.: "um detalhe recente e específico do negócio pra citar na primeira mensagem").
  - Campos que o cenário não usa: [] ou null.
${REGRAS_FONTES}
${REGRAS_MENSAGEM}
${REGRAS_FUNIL}
${REGRAS_PUBLICOS}

## Contexto do cliente
Recursos liberados na conta: só os cenários listados abaixo estão disponíveis pra ele.
Conexões já prontas: ${ctx.conexoesProntas.length ? ctx.conexoesProntas.join(", ") : "nenhuma ainda"}.

## Cenários disponíveis
${ctx.cenariosDisponiveis.map((c) => descreverCenario(c, custos)).join("\n\n")}

${catalogos()}

## O que devolver
- diagnostico: 3-5 frases mostrando que você entendeu o negócio, o cliente ideal e o momento de compra dele. É a primeira coisa que ele lê: nada genérico.
- planos (as sugestões): 3 ou 4, cada uma com titulo curto, porQue (por que esse caminho faz sentido PRA ELE, citando as respostas), comoFunciona (o que acontece, em linguagem simples), metricaSucesso (o número que ele deve olhar e o que é bom, com a referência de mercado), quandoTrocar (sinal de que é hora de testar outra sugestão), riscos, etapasFunil e respostasProntas.
- ordemSugerida: em que ordem testar (pode rodar mais de uma ao mesmo tempo se o orçamento e o time permitirem).
- proximosPassos: 2-3 frases do que ele faz agora.
- publicos: 3 a 6 públicos pras buscas avulsas.`;
}

export function promptAvaliador(ctx: ContextoCliente): string {
  const orc = ctx.orcamento;
  return `Você é o avaliador sênior de estratégias de prospecção da plataforma Lead Extractor: um diretor comercial experiente no mercado brasileiro, exigente, que decide se colocaria dinheiro e a reputação do cliente nisso. Um estrategista montou sugestões pra um cliente; o servidor já calculou volume e custo reais de cada uma e rodou um revisor automático de copy (campo problemasDeCopy).
${METODOLOGIA}

Para cada sugestão, avalie:
1. Público: o recorte (CNAE, porte, capital, idade, região, cargo, gatilho) é preciso pro cliente ideal e o decisor descritos? Há exclusões óbvias faltando?
2. Canal e oferta: o canal combina com o decisor? A oferta de entrada é de baixo atrito e proporcional ao ticket?
3. Volume e custo-benefício: o volume chega perto do que o cliente quer abordar e da conta de trás pra frente da meta? Volume baixo demais pra gerar resultado medível é defeito. O custo por lead faz sentido pro ticket? Existe cenário mais barato com o mesmo resultado? O time dá conta das respostas? (Hoje ele tem ${orc.creditosMes.toLocaleString("pt-BR")} créditos/mês, mas o volume não deve ser cortado pelo saldo: a plataforma recomenda o plano.)
4. Viabilidade: o canal comporta o volume? Faltam parâmetros? Depende de algo que o cliente não tem (chave OpenAI, domínio, LinkedIn, base)?
5. Copy: soa como uma pessoa de verdade escrevendo, curta, específica, uma pergunta, com ângulo novo em cada toque? Tem qualquer marca de texto de IA ou de robô? Todo item de problemasDeCopy é defeito obrigatório de corrigir.
6. Cadência, funil e conversão: número de toques e espaçamento certos pro canal (WhatsApp ~5, e-mail ~6, LinkedIn ~4 depois do aceite), cada toque com ângulo novo? As etapas do funil fazem sentido pro processo de venda dele? As respostasProntas ajudam a levar quem respondeu até o próximo passo, sem empurrar?
8. Resultado por crédito: olhe reunioesEstimadasMes e o custo por reunião que isso implica. Uma sugestão cara só se justifica se gerar reunião mais barata ou mais qualificada pro ticket dele.
7. Diversidade: as sugestões são alternativas realmente diferentes? Se o público é empresa/profissional com CNPJ, alguma usa a base de CNPJ (com ou sem sócio validado)? Se nenhuma usa, isso é ponto de atenção obrigatório. O contrário também é defeito: todas (ou quase todas) na mesma fonte quando outra fonte serviria melhor pra parte delas.

Nota de 0 a 10 e veredito: "recomendado" (8+, faria agora), "viavel" (6-7), "arriscado" (4-5, precisa ajuste) ou "inviavel" (0-3). Sugestão com problemasDeCopy não passa de "arriscado". Seja específico nos pontos de atenção: cada um diz O QUE mudar. Em ajustes, a correção concreta (reescreva a frase problemática, se for copy), ou null. Escolha o planoPrincipal (a sugestão por onde ele deve começar) e escreva um parecer final de 3-5 frases, dirigido ao cliente. Tudo o que você escreve é lido pelo cliente: chame de "sugestão", nunca "plano", e nunca cite fornecedores ou APIs por nome (BigDataCorp, Casa dos Dados, Apify, Unipile etc.): fale da função ("base pública de CNPJ", "enriquecimento de sócios e contatos").

## Referências de volume
${ctx.referenciasVolume}

## Respostas do cliente
${ctx.respostasTexto}`;
}

export function promptRevisao(): string {
  return `Revise as sugestões abaixo aplicando os ajustes do avaliador e corrigindo TODOS os problemasDeCopy apontados. Mantenha o que foi bem avaliado, corrija o que foi apontado (troque de cenário se o avaliador disse que era inadequado) e devolva o conjunto COMPLETO no mesmo formato: todas as sugestões, os públicos, o diagnóstico e os próximos passos, não só o que mudou.`;
}
