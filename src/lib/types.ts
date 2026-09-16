// Formato interno comum de um lead — superconjunto do que a busca CNPJ
// (Casa dos Dados) e a busca Google Maps podem preencher. Espelha as
// colunas da tabela `leads` (supabase/migrations/0001_init.sql).
export interface Lead {
  nome: string;
  telefone: string;
  telefone2: string;
  telefone_internacional: string;
  tipo_telefone: string;
  email: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  site: string;
  maps_url: string;
  avaliacao: number | string;
  total_avaliacoes: number | string;
  status_funcionamento: string;

  cnpj: string;
  cnae_codigo: string;
  matriz_filial: string;
  natureza_juridica: string;
  data_abertura: string;
  capital_social: string;
  simples_optante: string;
  mei_optante: string;
  situacao_especial: string;
  socio_principal: string;
  porte: string;

  nicho_busca: string;
  subnicho_busca: string;
  cidade_busca: string;
  estado_busca: string;
  comentario: string;
  fonte: string;

  instagram_id: string;
  username: string;
}

export function emptyLead(): Lead {
  return {
    nome: "", telefone: "", telefone2: "", telefone_internacional: "",
    tipo_telefone: "", email: "", endereco: "", municipio: "", uf: "",
    cep: "", site: "", maps_url: "", avaliacao: "", total_avaliacoes: "",
    status_funcionamento: "", cnpj: "", cnae_codigo: "", matriz_filial: "",
    natureza_juridica: "", data_abertura: "", capital_social: "",
    simples_optante: "", mei_optante: "", situacao_especial: "",
    socio_principal: "", porte: "", nicho_busca: "", subnicho_busca: "",
    cidade_busca: "", estado_busca: "", comentario: "", fonte: "",
    instagram_id: "", username: "",
  };
}

export type CnaeTipo = "principal" | "secundario" | "ambos";

export interface CnpjSearchFilters {
  cnaes: string[];
  uf: string[];
  municipio: string[];
  porte: string[];
  matrizFilial: "" | "MATRIZ" | "FILIAL";
  simplesOptante: boolean | null;
  excluirSimples: boolean;
  meiOptante: boolean | null;
  excluirMei: boolean;
  comTelefone: boolean;
  comEmail: boolean;
  somenteCelular: boolean;
  somenteFixo: boolean;
  excluirEmailContab: boolean;
  dataAberturaInicio: string; // "YYYY-MM-DD"
  dataAberturaFim: string;
  capitalMin: number | null;
  capitalMax: number | null;
  limite: number;
  apenasNovos: boolean;
  cnaeTipo: CnaeTipo;
  recuperacaoJudicial: boolean;
  mapsModo: "nao_usar" | "enriquecer" | "filtrar" | "filtrar_enriquecer";
  minAvaliacoes: number;
}

export interface MapsSearchFilters {
  nicho: string;
  subnicho: string;
  localidades: string[]; // "Cidade, UF" ou só "UF"
  limite: number;
  showPhone: boolean;
  showRating: boolean;
  apenasNovos: boolean;
}

export type InstagramTipo = "seguidores" | "seguindo";

export interface InstagramSearchFilters {
  tipo: InstagramTipo;
  alvo: string; // username ou URL
  limite: number;
  apenasNovos: boolean;
}
