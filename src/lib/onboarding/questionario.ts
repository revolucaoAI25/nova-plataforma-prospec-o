import { z } from "zod";

// Questionário do onboarding — fonte única das perguntas (a UI renderiza a
// partir de ETAPAS_QUESTIONARIO) e do formato das respostas que a IA recebe.
// Tudo opcional no schema: o cliente pode salvar rascunho a qualquer momento;
// o que é obrigatório pra gerar os planos está em `obrigatoria` e é checado
// por `pendenciasParaGerar`.

export type TipoPergunta = "texto" | "textarea" | "opcao" | "multi" | "numero" | "ufs";

export interface OpcaoPergunta {
  valor: string;
  label: string;
  ajuda?: string;
}

export interface Pergunta {
  id: keyof RespostasOnboarding;
  label: string;
  ajuda?: string;
  placeholder?: string;
  tipo: TipoPergunta;
  opcoes?: OpcaoPergunta[];
  obrigatoria?: boolean;
  /** Só aparece quando outra resposta tem um destes valores. */
  mostrarSe?: { pergunta: keyof RespostasOnboarding; valores: string[] };
}

export interface EtapaQuestionario {
  id: string;
  titulo: string;
  descricao: string;
  perguntas: Pergunta[];
}

const texto = z.string().max(4000).optional();
const lista = z.array(z.string().max(200)).max(50).optional();

export const respostasSchema = z.object({
  empresaNome: texto,
  site: texto,
  oQueVende: texto,
  diferencial: texto,
  provas: texto,
  ticketMedio: texto,
  modeloCobranca: texto,
  cicloVenda: texto,
  areaAtendimento: texto,

  tipoCliente: texto,
  segmentos: texto,
  cnaesConhecidos: texto,
  portes: lista,
  ufs: lista,
  cidades: texto,
  tempoEmpresa: texto,
  sinaisCompra: lista,
  exclusoes: texto,

  decisor: texto,
  cargos: texto,
  perfisReferencia: texto,

  canalPreferido: texto,
  whatsappDedicado: texto,
  dominioEmail: texto,
  linkedinAtivo: texto,
  toleranciaRisco: texto,
  temChaveOpenai: texto,

  volumeMensal: texto,
  vendedores: texto,
  capacidadeRespostas: texto,
  metaReunioes: texto,
  temAgenteIa: texto,

  temBase: texto,
  tamanhoBase: texto,
  baseTemCnpj: texto,

  tomVoz: texto,
  ofertaEntrada: texto,
  cta: texto,
  linkCta: texto,
  objecoes: texto,
  evitar: texto,
  observacoes: texto,
});

export type RespostasOnboarding = z.infer<typeof respostasSchema>;

const SIM_NAO: OpcaoPergunta[] = [
  { valor: "sim", label: "Sim" },
  { valor: "nao", label: "Não" },
];

export const ETAPAS_QUESTIONARIO: EtapaQuestionario[] = [
  {
    id: "empresa",
    titulo: "Sua empresa e o que você vende",
    descricao: "É daqui que saem as mensagens — quanto mais concreto, melhor o texto que a IA escreve por você.",
    perguntas: [
      { id: "empresaNome", label: "Nome da empresa", tipo: "texto", obrigatoria: true },
      { id: "site", label: "Site ou Instagram", tipo: "texto", placeholder: "https://…" },
      {
        id: "oQueVende", label: "O que você vende?", tipo: "textarea", obrigatoria: true,
        placeholder: "Ex.: software de gestão para clínicas odontológicas, com agenda online e lembrete automático por WhatsApp.",
      },
      {
        id: "diferencial", label: "Por que o cliente escolhe você e não o concorrente?", tipo: "textarea",
        placeholder: "Preço, rapidez, especialização, atendimento…",
      },
      {
        id: "provas", label: "Resultados, números ou clientes que você pode citar", tipo: "textarea",
        ajuda: "Opcional, mas mensagens com prova concreta respondem muito mais.",
      },
      {
        id: "ticketMedio", label: "Ticket médio de uma venda", tipo: "opcao", obrigatoria: true,
        opcoes: [
          { valor: "ate_500", label: "Até R$ 500" },
          { valor: "500_2k", label: "R$ 500 a R$ 2 mil" },
          { valor: "2k_10k", label: "R$ 2 mil a R$ 10 mil" },
          { valor: "10k_50k", label: "R$ 10 mil a R$ 50 mil" },
          { valor: "acima_50k", label: "Acima de R$ 50 mil" },
        ],
      },
      {
        id: "modeloCobranca", label: "Como você cobra?", tipo: "opcao",
        opcoes: [
          { valor: "unica", label: "Venda única" },
          { valor: "recorrente", label: "Mensalidade / recorrente" },
          { valor: "ambos", label: "Os dois" },
        ],
      },
      {
        id: "cicloVenda", label: "Quanto tempo leva, em média, do primeiro contato até fechar?", tipo: "opcao",
        opcoes: [
          { valor: "imediato", label: "Fecha na mesma conversa" },
          { valor: "dias", label: "Alguns dias" },
          { valor: "semanas", label: "Algumas semanas" },
          { valor: "meses", label: "Meses" },
        ],
      },
      {
        id: "areaAtendimento", label: "Onde você atende?", tipo: "opcao", obrigatoria: true,
        opcoes: [
          { valor: "local", label: "Só na minha cidade / região" },
          { valor: "estadual", label: "No meu estado" },
          { valor: "nacional", label: "Brasil todo" },
        ],
      },
    ],
  },
  {
    id: "cliente",
    titulo: "Seu cliente ideal",
    descricao: "Define de onde os leads vão sair: base de CNPJ, Google Maps, LinkedIn ou Instagram.",
    perguntas: [
      {
        id: "tipoCliente", label: "Pra quem você vende?", tipo: "opcao", obrigatoria: true,
        opcoes: [
          { valor: "empresas_b2b", label: "Empresas (B2B)", ajuda: "Indústrias, distribuidoras, escritórios, prestadores de serviço…" },
          { valor: "negocios_locais", label: "Negócios locais", ajuda: "Lojas, clínicas, restaurantes, academias, salões — quem aparece no Google Maps." },
          { valor: "profissionais_liberais", label: "Profissionais liberais", ajuda: "Médicos, dentistas, advogados, contadores, arquitetos…" },
          { valor: "empresas_medias_grandes", label: "Empresas médias e grandes", ajuda: "Venda consultiva pra um cargo específico (RH, TI, compras, diretoria)." },
          { valor: "pessoas_fisicas", label: "Pessoas físicas (B2C)", ajuda: "Consumidor final." },
        ],
      },
      {
        id: "segmentos", label: "Quais segmentos ou nichos?", tipo: "textarea", obrigatoria: true,
        placeholder: "Ex.: clínicas odontológicas e de estética; transportadoras de pequeno porte.",
      },
      {
        id: "cnaesConhecidos", label: "Você conhece os CNAEs deles?", tipo: "texto",
        ajuda: "Opcional. Se não souber, a IA escolhe a partir dos segmentos.", placeholder: "Ex.: 8630-5/04, 6920-6/01",
      },
      {
        id: "portes", label: "Porte das empresas", tipo: "multi",
        opcoes: [
          { valor: "mei", label: "MEI" },
          { valor: "me", label: "Microempresa" },
          { valor: "epp", label: "Pequeno porte" },
          { valor: "demais", label: "Médio e grande porte" },
          { valor: "indiferente", label: "Tanto faz" },
        ],
      },
      { id: "ufs", label: "Estados", tipo: "ufs", ajuda: "Deixe vazio pra Brasil todo." },
      { id: "cidades", label: "Cidades específicas", tipo: "texto", placeholder: "Ex.: Belo Horizonte, Contagem, Betim" },
      {
        id: "tempoEmpresa", label: "Idade da empresa", tipo: "opcao",
        opcoes: [
          { valor: "indiferente", label: "Tanto faz" },
          { valor: "recem_abertas", label: "Recém-abertas (últimos meses)", ajuda: "Quem acabou de abrir costuma precisar de contador, banco, sistema, marketing, seguro…" },
          { valor: "consolidadas", label: "Consolidadas (mais de 2 anos)" },
        ],
      },
      {
        id: "sinaisCompra", label: "Algum sinal indica que a empresa precisa de você agora?", tipo: "multi",
        opcoes: [
          { valor: "recem_aberta", label: "Acabou de abrir" },
          { valor: "presenca_google", label: "Está no Google com boas avaliações" },
          { valor: "sem_site", label: "Não tem site" },
          { valor: "ativa_instagram", label: "É ativa no Instagram" },
          { valor: "recuperacao_judicial", label: "Está em recuperação judicial" },
          { valor: "nenhum", label: "Nenhum específico" },
        ],
      },
      { id: "exclusoes", label: "Quem NÃO deve ser abordado?", tipo: "textarea", placeholder: "Concorrentes, clientes atuais, algum segmento…" },
    ],
  },
  {
    id: "decisor",
    titulo: "Com quem você quer falar",
    descricao: "Falar com a pessoa certa muda tudo — e muda o canal e o custo por lead.",
    perguntas: [
      {
        id: "decisor", label: "Quem decide a compra?", tipo: "opcao", obrigatoria: true,
        opcoes: [
          { valor: "dono_socio", label: "O dono / sócio" },
          { valor: "diretor_gerente", label: "Um diretor ou gerente" },
          { valor: "area_especifica", label: "Uma área específica (RH, TI, compras, marketing…)" },
          { valor: "qualquer_contato", label: "Qualquer contato da empresa serve" },
        ],
      },
      {
        id: "cargos", label: "Cargos que você quer atingir", tipo: "texto",
        mostrarSe: { pergunta: "decisor", valores: ["diretor_gerente", "area_especifica"] },
        placeholder: "Ex.: Diretor de RH, Gerente de Compras, CTO",
      },
      {
        id: "perfisReferencia", label: "Perfis de Instagram cujo público é parecido com o seu cliente", tipo: "texto",
        ajuda: "Opcional. Ex.: um concorrente, um influenciador do nicho. Usamos os seguidores como lista.",
        placeholder: "@perfil1, @perfil2",
      },
    ],
  },
  {
    id: "canais",
    titulo: "Canais de contato",
    descricao: "A gente escolhe o canal pelo que funciona pro seu público — e pelo que você já tem.",
    perguntas: [
      {
        id: "canalPreferido", label: "Você tem preferência de canal?", tipo: "opcao", obrigatoria: true,
        opcoes: [
          { valor: "whatsapp", label: "WhatsApp" },
          { valor: "email", label: "E-mail" },
          { valor: "linkedin", label: "LinkedIn" },
          { valor: "sem_preferencia", label: "Sem preferência — me recomendem" },
        ],
      },
      {
        id: "whatsappDedicado", label: "Tem um número de WhatsApp só pra prospecção?", tipo: "opcao",
        opcoes: [
          { valor: "sim", label: "Sim" },
          { valor: "nao", label: "Não" },
          { valor: "vou_providenciar", label: "Vou providenciar" },
        ],
        ajuda: "Nunca use seu número principal pra disparo — ele pode ser bloqueado.",
      },
      {
        id: "dominioEmail", label: "Tem um domínio de e-mail próprio (ex.: voce@suaempresa.com.br)?", tipo: "opcao",
        opcoes: [...SIM_NAO, { valor: "nao_sei", label: "Não sei" }],
      },
      { id: "linkedinAtivo", label: "Você (ou alguém do time) tem um perfil de LinkedIn ativo?", tipo: "opcao", opcoes: SIM_NAO },
      {
        id: "toleranciaRisco", label: "Como você prefere equilibrar volume e segurança da conta?", tipo: "opcao",
        opcoes: [
          { valor: "conservador", label: "Conservador — menos volume, risco mínimo de bloqueio" },
          { valor: "equilibrado", label: "Equilibrado" },
          { valor: "agressivo", label: "Agressivo — mais volume, aceito o risco" },
        ],
      },
      {
        id: "temChaveOpenai", label: "Tem uma conta na OpenAI (ChatGPT API)?", tipo: "opcao",
        opcoes: [...SIM_NAO, { valor: "nao_sei", label: "Não sei o que é" }],
        ajuda: "Só é usada nos planos com pesquisa e personalização por IA — o custo vai direto na sua conta OpenAI.",
      },
    ],
  },
  {
    id: "volume",
    titulo: "Volume e capacidade do time",
    descricao: "Não adianta gerar mais conversas do que o time consegue atender.",
    perguntas: [
      {
        id: "volumeMensal", label: "Quantos contatos novos por mês você quer abordar?", tipo: "opcao", obrigatoria: true,
        opcoes: [
          { valor: "ate_300", label: "Até 300" },
          { valor: "300_1000", label: "300 a 1.000" },
          { valor: "1000_3000", label: "1.000 a 3.000" },
          { valor: "3000_10000", label: "3.000 a 10.000" },
          { valor: "acima_10000", label: "Mais de 10.000" },
        ],
      },
      { id: "vendedores", label: "Quantas pessoas atendem as respostas?", tipo: "numero", placeholder: "1" },
      {
        id: "capacidadeRespostas", label: "Quantas conversas novas o time aguenta por dia?", tipo: "opcao",
        opcoes: [
          { valor: "ate_10", label: "Até 10" },
          { valor: "10_30", label: "10 a 30" },
          { valor: "30_100", label: "30 a 100" },
          { valor: "acima_100", label: "Mais de 100" },
        ],
      },
      { id: "metaReunioes", label: "Meta de reuniões ou vendas por mês", tipo: "numero" },
      {
        id: "temAgenteIa", label: "Quer um agente de IA atendendo as respostas no WhatsApp?", tipo: "opcao",
        opcoes: [
          { valor: "ja_tenho", label: "Já tenho" },
          { valor: "quero", label: "Quero conhecer" },
          { valor: "nao", label: "Não, meu time atende" },
        ],
      },
    ],
  },
  {
    id: "base",
    titulo: "Sua base atual",
    descricao: "Uma base parada é o jeito mais barato de começar.",
    perguntas: [
      {
        id: "temBase", label: "Você já tem uma lista de contatos?", tipo: "opcao", obrigatoria: true,
        opcoes: [
          { valor: "nao", label: "Não" },
          { valor: "planilha", label: "Sim, numa planilha" },
          { valor: "crm", label: "Sim, num CRM" },
        ],
      },
      {
        id: "tamanhoBase", label: "Tamanho aproximado", tipo: "opcao",
        mostrarSe: { pergunta: "temBase", valores: ["planilha", "crm"] },
        opcoes: [
          { valor: "ate_500", label: "Até 500" },
          { valor: "500_5000", label: "500 a 5.000" },
          { valor: "acima_5000", label: "Mais de 5.000" },
        ],
      },
      {
        id: "baseTemCnpj", label: "A lista tem CNPJ?", tipo: "opcao",
        mostrarSe: { pergunta: "temBase", valores: ["planilha", "crm"] },
        opcoes: [...SIM_NAO, { valor: "parcial", label: "Parte dela" }],
      },
    ],
  },
  {
    id: "mensagem",
    titulo: "Sua mensagem",
    descricao: "A IA escreve as mensagens de cada plano com base nisso — você revisa antes de dar play.",
    perguntas: [
      {
        id: "tomVoz", label: "Tom de voz", tipo: "opcao",
        opcoes: [
          { valor: "formal", label: "Formal" },
          { valor: "consultivo", label: "Consultivo" },
          { valor: "descontraido", label: "Descontraído" },
          { valor: "direto", label: "Direto ao ponto" },
        ],
      },
      {
        id: "ofertaEntrada", label: "O que você oferece no primeiro contato?", tipo: "textarea", obrigatoria: true,
        placeholder: "Ex.: um diagnóstico gratuito de 20 minutos; uma amostra; uma condição especial pro primeiro mês.",
      },
      {
        id: "cta", label: "Qual o próximo passo que você quer do lead?", tipo: "opcao", obrigatoria: true,
        opcoes: [
          { valor: "agendar_reuniao", label: "Agendar uma reunião" },
          { valor: "responder", label: "Só responder demonstrando interesse" },
          { valor: "clicar_link", label: "Clicar num link" },
          { valor: "ligar", label: "Receber uma ligação" },
        ],
      },
      { id: "linkCta", label: "Link (agenda, página, catálogo)", tipo: "texto", mostrarSe: { pergunta: "cta", valores: ["clicar_link", "agendar_reuniao"] } },
      { id: "objecoes", label: "Objeções que você mais ouve", tipo: "textarea", placeholder: "Já tenho fornecedor; está caro; agora não é o momento…" },
      { id: "evitar", label: "O que NÃO pode aparecer nas mensagens?", tipo: "textarea" },
      { id: "observacoes", label: "Algo mais que a gente deveria saber?", tipo: "textarea" },
    ],
  },
];

const TODAS_PERGUNTAS = ETAPAS_QUESTIONARIO.flatMap((e) => e.perguntas);

export function perguntaVisivel(p: Pergunta, respostas: RespostasOnboarding): boolean {
  if (!p.mostrarSe) return true;
  const valor = respostas[p.mostrarSe.pergunta];
  return typeof valor === "string" && p.mostrarSe.valores.includes(valor);
}

function respondida(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.length > 0;
  return typeof valor === "string" && valor.trim().length > 0;
}

/** Perguntas obrigatórias (e visíveis) ainda sem resposta. */
export function pendenciasParaGerar(respostas: RespostasOnboarding): Pergunta[] {
  return TODAS_PERGUNTAS.filter((p) => p.obrigatoria && perguntaVisivel(p, respostas) && !respondida(respostas[p.id]));
}

/** Respostas em texto legível (rótulos, não códigos) — é isso que vai pro prompt da IA. */
export function respostasLegiveis(respostas: RespostasOnboarding): string {
  const linhas: string[] = [];
  for (const etapa of ETAPAS_QUESTIONARIO) {
    const itens: string[] = [];
    for (const p of etapa.perguntas) {
      if (!perguntaVisivel(p, respostas)) continue;
      const valor = respostas[p.id];
      if (!respondida(valor)) continue;
      const rotulo = (v: string) => p.opcoes?.find((o) => o.valor === v)?.label ?? v;
      const texto = Array.isArray(valor) ? valor.map(rotulo).join(", ") : rotulo(String(valor));
      itens.push(`- ${p.label}: ${texto}`);
    }
    if (itens.length) linhas.push(`## ${etapa.titulo}`, ...itens, "");
  }
  return linhas.join("\n").trim();
}
