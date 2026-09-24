import type { FlowNode, FlowEdge, FlowNodeTipo, Json } from "@/lib/database.types";
import type { LucideIconName } from "./node-types";

/**
 * Catálogo de fluxos prontos — ponto de partida pra quem nunca montou um
 * fluxo, e automações já úteis de cara pra quem só quer usar. Não são
 * `automation_flows` de ninguém: são só dados estáticos (como `NICHOS` ou
 * `CNAES`) que a página "Novo fluxo" usa pra pré-popular o canvas quando o
 * usuário escolhe um — o fluxo só é criado de verdade quando ele clica
 * Salvar (nada é gravado no banco ao só olhar/escolher um template).
 *
 * Campos que dependem de algo específico do usuário (qual planilha, qual
 * campanha, qual pesquisa do histórico, quais CNAEs/cidades) ficam vazios
 * de propósito — o ícone de alerta no nó já sinaliza "falta configurar",
 * igual a qualquer nó incompleto. Só o que é seguro assumir (agendamento
 * padrão, limites, toggles) já vem preenchido.
 */

export interface FlowTemplate {
  id: string;
  nome: string;
  descricao: string;
  icon: LucideIconName;
  /** Resumo curto da cadeia de nós, só pra exibição no card (ex.: "Agendado → CNPJ → Sheets"). */
  resumoEtapas: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function no(id: string, tipo: FlowNodeTipo, x: number, config: Record<string, unknown> = {}): FlowNode {
  return { id, tipo, config: config as Json, posicao: { x, y: 160 } };
}

function cadeia(ids: string[]): FlowEdge[] {
  const edges: FlowEdge[] = [];
  for (let i = 0; i < ids.length - 1; i++) {
    edges.push({ id: `e-${ids[i]}-${ids[i + 1]}`, from: ids[i], to: ids[i + 1] });
  }
  return edges;
}

const PASSO_X = 300;

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "cnpj-diario-planilha",
    nome: "Prospecção CNPJ diária → Planilha",
    descricao: "Todo dia útil de manhã, busca empresas novas pelo CNAE e UF que você escolher e exporta direto pra uma planilha — sem precisar abrir a tela de busca.",
    icon: "Building2",
    resumoEtapas: "Agendado (seg–sex 08:00) → Extração CNPJ → Planilha",
    nodes: [
      no("gatilho", "gatilho_agendado", 0 * PASSO_X, { diasSemana: [1, 2, 3, 4, 5], horario: "08:00" }),
      no("extracao", "extracao_cnpj", 1 * PASSO_X, {
        limite: 100, apenasNovos: true, comTelefone: true, excluirEmailContab: true, cnaeTipo: "principal",
      }),
      no("destino", "destino_sheets", 2 * PASSO_X, { modo: "acrescentar" }),
    ],
    edges: cadeia(["gatilho", "extracao", "destino"]),
  },
  {
    id: "funil-maps-ia-whatsapp",
    nome: "Funil completo: Maps → IA → WhatsApp",
    descricao: "O fluxo mais robusto: busca estabelecimentos numa cidade, enriquece cada um via IA, filtra só quem foi encontrado com sucesso, e já inscreve na campanha de disparo. Cidade e estado são parâmetros — dá pra rodar pra qualquer praça sem editar o fluxo.",
    icon: "Send",
    resumoEtapas: "Manual (cidade/UF) → Maps → Enriquecimento IA → Filtro → WhatsApp",
    nodes: [
      no("gatilho", "gatilho_manual", 0 * PASSO_X, {
        variaveis: [
          { chave: "cidade", label: "Cidade", padrao: "São Paulo" },
          { chave: "estado", label: "Estado (UF)", padrao: "SP" },
        ],
      }),
      no("extracao", "extracao_maps", 1 * PASSO_X, {
        cidades: ["{{variaveis.cidade}}"], estados: ["{{variaveis.estado}}"],
        showPhone: true, showRating: true, apenasNovos: true, limite: 60,
      }),
      no("enriquecimento", "enriquecimento_ia", 2 * PASSO_X, {
        nivelRaciocinio: "equilibrado", buscarSocios: false, buscarFundacao: false, buscarProcessos: false,
      }),
      no("filtro", "filtro_leads", 3 * PASSO_X, { campo: "enriquecimento_status", operador: "igual", valor: "concluido" }),
      no("disparo", "disparo_whatsapp", 4 * PASSO_X, {}),
    ],
    edges: cadeia(["gatilho", "extracao", "enriquecimento", "filtro", "disparo"]),
  },
  {
    id: "enriquecer-historico-planilha",
    nome: "Enriquecer leads do histórico → Planilha",
    descricao: "Pega uma pesquisa que você já fez, passa todos os leads pelo enriquecimento via IA e exporta o resultado (com empresa, cargo, site, resumo…) pra uma planilha nova.",
    icon: "BrainCircuit",
    resumoEtapas: "Manual → Pesquisa do histórico → Enriquecimento IA → Planilha",
    nodes: [
      no("gatilho", "gatilho_manual", 0 * PASSO_X, {}),
      no("fonte", "fonte_historico", 1 * PASSO_X, {}),
      no("enriquecimento", "enriquecimento_ia", 2 * PASSO_X, { nivelRaciocinio: "equilibrado", buscarSocios: true, buscarFundacao: true, buscarProcessos: false }),
      no("destino", "destino_sheets", 3 * PASSO_X, { modo: "substituir" }),
    ],
    edges: cadeia(["gatilho", "fonte", "enriquecimento", "destino"]),
  },
  {
    id: "planilha-monitorada-disparo",
    nome: "Planilha monitorada → Disparo automático",
    descricao: "Você mantém uma planilha (própria, de indicações, de um formulário…) e toda linha nova vira um disparo automático de WhatsApp — sem precisar inscrever manualmente.",
    icon: "Sheet",
    resumoEtapas: "Nova linha na planilha → WhatsApp",
    nodes: [
      no("gatilho", "gatilho_planilha", 0 * PASSO_X, { colunaTelefone: "telefone", colunaNome: "nome" }),
      no("disparo", "disparo_whatsapp", 1 * PASSO_X, {}),
    ],
    edges: cadeia(["gatilho", "disparo"]),
  },
  {
    id: "filtro-leads-whatsapp",
    nome: "Novo lead no filtro → WhatsApp automático",
    descricao: "Sempre que uma busca sua (de qualquer canal) trouxer um lead novo batendo com o nicho/UF escolhido, ele entra direto numa campanha de disparo — útil pra não esquecer de inscrever ninguém.",
    icon: "Filter",
    resumoEtapas: "Novo lead no filtro → WhatsApp",
    nodes: [
      no("gatilho", "gatilho_filtro_leads", 0 * PASSO_X, {}),
      no("disparo", "disparo_whatsapp", 1 * PASSO_X, {}),
    ],
    edges: cadeia(["gatilho", "disparo"]),
  },
  {
    id: "maps-enriquecimento-maps-planilha",
    nome: "Google Maps + perfil completo → Planilha",
    descricao: "Busca rápida e barata no Maps (sem telefone/site ainda), depois enriquece só quem sobrou com dados completos do Maps e filtra pra manter só perfis com avaliação de verdade — economiza cota antes de gastar com detalhes.",
    icon: "MapPinned",
    resumoEtapas: "Agendado → Maps (rápido) → Enriquecimento Maps (filtra) → Planilha",
    nodes: [
      no("gatilho", "gatilho_agendado", 0 * PASSO_X, { diasSemana: [1, 2, 3, 4, 5], horario: "09:00" }),
      no("extracao", "extracao_maps", 1 * PASSO_X, { showPhone: false, showRating: false, apenasNovos: true, limite: 100 }),
      no("enriquecimento", "enriquecimento_maps", 2 * PASSO_X, { showPhone: true, filtrar: true, minAvaliacoes: 5 }),
      no("destino", "destino_sheets", 3 * PASSO_X, { modo: "acrescentar" }),
    ],
    edges: cadeia(["gatilho", "extracao", "enriquecimento", "destino"]),
  },
  {
    id: "linkedin-ia-planilha",
    nome: "Captação LinkedIn + IA → Planilha",
    descricao: "Busca decisores por cargo/localização/setor no LinkedIn (estilo Sales Navigator), enriquece cada perfil via IA e exporta tudo pra uma planilha — bom pra prospecção B2B mais qualificada.",
    icon: "UserSearch",
    resumoEtapas: "Manual → LinkedIn → Enriquecimento IA → Planilha",
    nodes: [
      no("gatilho", "gatilho_manual", 0 * PASSO_X, {}),
      no("extracao", "extracao_linkedin", 1 * PASSO_X, { buscarEmail: false, apenasNovos: true, limite: 100 }),
      no("enriquecimento", "enriquecimento_ia", 2 * PASSO_X, { nivelRaciocinio: "equilibrado", buscarSocios: false, buscarFundacao: false, buscarProcessos: false }),
      no("destino", "destino_sheets", 3 * PASSO_X, { modo: "acrescentar" }),
    ],
    edges: cadeia(["gatilho", "extracao", "enriquecimento", "destino"]),
  },
  {
    id: "instagram-espera-disparo",
    nome: "Captação Instagram + espera → Disparo",
    descricao: "Extrai seguidores de um perfil e espera 1 dia antes de disparar — evita que o contato pareça um bot batendo na mesma hora que capturou o lead.",
    icon: "Hourglass",
    resumoEtapas: "Manual → Instagram → Espera (1 dia) → WhatsApp",
    nodes: [
      no("gatilho", "gatilho_manual", 0 * PASSO_X, {}),
      no("extracao", "extracao_instagram", 1 * PASSO_X, { tipo: "seguidores", apenasNovos: true, limite: 200 }),
      no("espera", "espera", 2 * PASSO_X, { minutos: 1440 }),
      no("disparo", "disparo_whatsapp", 3 * PASSO_X, {}),
    ],
    edges: cadeia(["gatilho", "extracao", "espera", "disparo"]),
  },
];
