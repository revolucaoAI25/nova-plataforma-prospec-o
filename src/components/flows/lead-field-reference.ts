import type { FlowNodeTipo } from "@/lib/database.types";

/**
 * Campos que o lead tem em cada ponto do fluxo, conforme os módulos que
 * vieram antes. Usado no painel do construtor pra mostrar quais `{{campo}}`
 * a mensagem da campanha pode usar a partir daquele disparo. É um guia: o
 * campo só vem preenchido se a origem trouxe o dado para aquele lead.
 */
export interface CampoReferencia {
  chave: string;
  label: string;
}

export interface GrupoCampos {
  grupo: string;
  campos: CampoReferencia[];
}

/** Calculados na hora do envio, para qualquer lead (ver src/lib/mensagem.ts). */
export const CAMPOS_PRONTOS: GrupoCampos = {
  grupo: "Prontos para mensagem (já arrumados)",
  campos: [
    { chave: "primeiro_nome", label: "Primeiro nome do sócio ou da pessoa" },
    { chave: "empresa", label: "Nome da empresa sem LTDA e sem caixa alta" },
    { chave: "cidade", label: "Cidade" },
  ],
};

const CNPJ: GrupoCampos = {
  grupo: "Da busca por CNPJ",
  campos: [
    { chave: "socio_principal", label: "Nome completo do sócio principal (o administrador, quando há)" },
    { chave: "celular_socio", label: "Celular do sócio (quando a busca pediu)" },
    { chave: "socios", label: "Todos os sócios" },
    { chave: "telefone", label: "Telefone" },
    { chave: "email", label: "E-mail" },
    { chave: "porte", label: "Porte" },
    { chave: "bairro", label: "Bairro" },
    { chave: "uf", label: "UF" },
    { chave: "cnpj", label: "CNPJ" },
    { chave: "nome", label: "Razão social (em caixa alta)" },
  ],
};

const MAPS: GrupoCampos = {
  grupo: "Do Google Maps",
  campos: [
    { chave: "nome", label: "Nome do estabelecimento" },
    { chave: "telefone", label: "Telefone" },
    { chave: "site", label: "Site" },
    { chave: "avaliacao", label: "Nota no Google" },
    { chave: "total_avaliacoes", label: "Número de avaliações" },
    { chave: "bairro", label: "Bairro" },
  ],
};

const LINKEDIN: GrupoCampos = {
  grupo: "Do LinkedIn",
  campos: [
    { chave: "nome", label: "Nome da pessoa" },
    { chave: "cargo", label: "Cargo" },
    { chave: "empresa_atual", label: "Empresa atual" },
  ],
};

const INSTAGRAM: GrupoCampos = {
  grupo: "Do Instagram",
  campos: [
    { chave: "username", label: "@ do perfil" },
    { chave: "nome_completo", label: "Nome no perfil" },
  ],
};

const SOCIOS: GrupoCampos = {
  grupo: "Do Celular do sócio",
  campos: [
    { chave: "socio_nome", label: "Nome completo do sócio encontrado" },
    { chave: "socio_cargo", label: "Cargo do sócio" },
    { chave: "socio_celular", label: "Celular do sócio (também vira o telefone do lead)" },
    { chave: "telefone_empresa", label: "Telefone da empresa" },
    { chave: "bigdatacorp_socios", label: "Todos os sócios" },
  ],
};

const IA: GrupoCampos = {
  grupo: "Do Enriquecimento via IA",
  campos: [
    { chave: "enriquecimento_empresa", label: "Empresa" },
    { chave: "enriquecimento_cargo", label: "Cargo" },
    { chave: "enriquecimento_resumo", label: "Resumo da empresa" },
  ],
};

const MAPS_ENRIQ: GrupoCampos = {
  grupo: "Do Enriquecimento via Maps",
  campos: [
    { chave: "site", label: "Site" },
    { chave: "avaliacao", label: "Nota no Google" },
    { chave: "total_avaliacoes", label: "Número de avaliações" },
  ],
};

const RAMO_DISPARO: GrupoCampos = {
  grupo: "De um ramo de disparo (Enviou, Falhou…)",
  campos: [
    { chave: "resultado_disparo", label: "Saída por onde o lead veio" },
    { chave: "contato_que_falhou", label: "Contato que falhou" },
  ],
};

const POR_TIPO: Partial<Record<FlowNodeTipo, GrupoCampos>> = {
  extracao_cnpj: CNPJ,
  gatilho_filtro_leads: CNPJ,
  fonte_historico: CNPJ,
  extracao_maps: MAPS,
  extracao_linkedin: LINKEDIN,
  extracao_instagram: INSTAGRAM,
  enriquecimento_bigdatacorp: SOCIOS,
  enriquecimento_ia: IA,
  enriquecimento_maps: MAPS_ENRIQ,
};

/** Grupos de campos que existem num ponto do fluxo, dados os módulos anteriores. */
export function camposDisponiveis(tiposAnteriores: FlowNodeTipo[], viaRamoDisparo: boolean): { grupos: GrupoCampos[]; dePlanilha: boolean } {
  const grupos: GrupoCampos[] = [CAMPOS_PRONTOS];
  const vistos = new Set<GrupoCampos>();
  for (const t of tiposAnteriores) {
    const g = POR_TIPO[t];
    if (g && !vistos.has(g)) {
      vistos.add(g);
      grupos.push(g);
    }
  }
  if (viaRamoDisparo) grupos.push(RAMO_DISPARO);
  return { grupos, dePlanilha: tiposAnteriores.includes("gatilho_planilha") };
}
